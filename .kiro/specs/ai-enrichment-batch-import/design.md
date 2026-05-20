# Design Document: AI Enrichment Batch Import

## Overview

本設計は、AI Bookmark Enrichment のバッチ処理キューとインポート時の Collection モード選択を実現する。

現在の実装では `triggerAIEnrichment` が `aiAbortRef.current?.abort()` で前回リクエストをキャンセルしてから新しいリクエストを発行するため、インポート時に大量のブックマークが入ると最後の1件だけ AI 補完が適用される。本設計ではキュー方式に変更し、コンカレンシー制御付きで全件を処理する。

また、インポート時の Collection 取り扱いについて「フォルダ構成を引き継ぐ」（既存動作）と「フラットに取り込む」（AI が既存 Collection に振り分け）の2モードを選択可能にする。

### 設計方針

- **既存コードへの影響を最小化**: `enrichmentQueue.ts` を新規モジュールとして追加し、`page.tsx` の `triggerAIEnrichment` を置き換える
- **段階的な移行**: QuickAdd の単件追加も同じキューを経由させ、キューが1件の場合は実質的に即時処理となる
- **UI ロジックとキューロジックの分離**: キューは純粋なリクエスト管理モジュールとし、React の状態更新はコールバック経由で行う

## Architecture

```mermaid
flowchart TD
    subgraph UI Layer
        QA[QuickAdd]
        ID[ImportDialog]
        PI[ProgressIndicator]
    end

    subgraph Hook Layer
        PT[page.tsx - triggerOGPFetch]
        UI[useImport.ts]
    end

    subgraph Queue Module
        EQ[EnrichmentQueue]
    end

    subgraph API Layer
        API[/api/ai-enrich]
    end

    QA -->|bookmark created| PT
    ID -->|import complete| PT
    PT -->|enqueue| EQ
    EQ -->|fetch with concurrency=3| API
    EQ -->|onItemComplete callback| PT
    EQ -->|onProgress callback| PI
    UI -->|collectionMode| ID
```

### データフロー

1. **QuickAdd フロー**: QuickAdd → createBookmark → triggerOGPFetch → OGP 完了 → `enrichmentQueue.enqueue()` → API 呼び出し → onItemComplete → updateBookmark
2. **Import フロー**: ImportDialog → useImport.startImport(parseResult, strategy, collectionMode) → Bookmark 作成 → triggerOGPFetch(全件) → 各 OGP 完了 → `enrichmentQueue.enqueue()` → API 呼び出し → onItemComplete → updateBookmark（collectionMode に応じて suggestedCollection の適用を制御）

## Components and Interfaces

### 1. EnrichmentQueue モジュール (`src/lib/ai/enrichmentQueue.ts`)

キューイングとコンカレンシー制御を担う純粋な TypeScript モジュール。React に依存しない。

```typescript
/** キューに投入するアイテム */
export interface EnrichmentQueueItem {
  bookmarkId: string;
  url: string;
  ogpTitle: string;
  ogpDescription: string;
  /** folder-inherit モードで collectionId が既に設定されている場合 true */
  hasCollectionId: boolean;
}

/** キューの進捗情報 */
export interface EnrichmentQueueProgress {
  total: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

/** キュー完了時のシグナル */
export interface EnrichmentQueueResult {
  totalProcessed: number;
  failedCount: number;
}

/** アイテム完了時のコールバック引数 */
export interface EnrichmentItemResult {
  bookmarkId: string;
  enrichmentResult: EnrichmentResult | null; // null = 失敗
  hasCollectionId: boolean;
}

/** キューのコンフィグ */
export interface EnrichmentQueueConfig {
  concurrency: number; // デフォルト 3
  existingTags: string[];
  existingCollections: string[];
  signal?: AbortSignal;
  onItemComplete: (result: EnrichmentItemResult) => void;
  onProgress: (progress: EnrichmentQueueProgress) => void;
  onComplete: (result: EnrichmentQueueResult) => void;
}

export class EnrichmentQueue {
  private queue: EnrichmentQueueItem[];
  private inFlight: number;
  private completed: number;
  private failed: number;
  private config: EnrichmentQueueConfig;
  private isProcessing: boolean;

  constructor(config: EnrichmentQueueConfig);

  /** アイテムをキューに追加。処理中なら末尾に追加して自動的に処理開始 */
  enqueue(item: EnrichmentQueueItem): void;

  /** 複数アイテムを一括追加 */
  enqueueBatch(items: EnrichmentQueueItem[]): void;

  /** キュー処理を開始（既に処理中なら何もしない） */
  start(): void;

  /** 全ての pending リクエストを中断 */
  abort(): void;

  /** 現在の進捗を取得 */
  getProgress(): EnrichmentQueueProgress;
}
```

**内部動作:**
- `enqueue()` が呼ばれるたびに `queue` に追加し、`inFlight < concurrency` なら即座に次のアイテムを処理開始
- 各アイテムは `/api/ai-enrich` に fetch し、成功/失敗に関わらず `onItemComplete` を呼び出す
- 失敗時は `console.warn` でログし、`failed` カウントをインクリメントして次のアイテムへ進む
- `signal.aborted` が true になったら処理を停止
- 全アイテム完了時に `onComplete` を呼び出す

### 2. page.tsx の変更

```typescript
// 既存の aiAbortRef と triggerAIEnrichment を削除し、EnrichmentQueue インスタンスに置き換え

const enrichmentQueueRef = useRef<EnrichmentQueue | null>(null);
const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentQueueProgress | null>(null);

// キューの初期化（コンポーネントマウント時）
useEffect(() => {
  const queue = new EnrichmentQueue({
    concurrency: 3,
    existingTags: tags.map(t => t.name),
    existingCollections: collections.map(c => c.name),
    onItemComplete: (result) => {
      if (!result.enrichmentResult) return;
      // updateBookmark + tag 適用ロジック（既存の triggerAIEnrichment 内のロジックを移植）
      applyEnrichmentResult(result);
    },
    onProgress: setEnrichmentProgress,
    onComplete: (result) => {
      // 3秒後に進捗表示を非表示
      setTimeout(() => setEnrichmentProgress(null), 3000);
    },
  });
  enrichmentQueueRef.current = queue;
  return () => queue.abort();
}, [tags, collections]);

// triggerOGPFetch 内の triggerAIEnrichment 呼び出しを enqueue に置き換え
// OGP 取得成功後:
enrichmentQueueRef.current?.enqueue({
  bookmarkId,
  url,
  ogpTitle: ogp.title || "",
  ogpDescription: ogp.description || "",
  hasCollectionId: false, // QuickAdd の場合は false
});
```

### 3. ImportDialog の変更 (`src/components/import/ImportDialog.tsx`)

Preview ステージにラジオボタングループを追加:

```typescript
type ImportCollectionMode = "folder-inherit" | "flat";

// state 追加
const [collectionMode, setCollectionMode] = useState<ImportCollectionMode>("folder-inherit");

// Preview ステージの UI に追加
<fieldset className={styles.collectionModeGroup}>
  <legend>Collection の取り扱い</legend>
  <label>
    <input
      type="radio"
      name="collectionMode"
      value="folder-inherit"
      checked={collectionMode === "folder-inherit"}
      onChange={() => setCollectionMode("folder-inherit")}
    />
    フォルダ構成を引き継ぐ
  </label>
  <label>
    <input
      type="radio"
      name="collectionMode"
      value="flat"
      checked={collectionMode === "flat"}
      onChange={() => setCollectionMode("flat")}
    />
    フラットに取り込む（AI が Collection を提案）
  </label>
</fieldset>

// collectionMode に応じた表示切り替え
{collectionMode === "folder-inherit" && <FolderPreview folders={parseResult.folders} />}
{collectionMode === "flat" && (
  <p className={styles.flatModeMessage}>
    全てのブックマークを Collection なしでインポートします。AI 補完が有効な場合、既存の Collection から適切なものが自動的に割り当てられます。
  </p>
)}
```

### 4. useImport.ts の変更

`startImport` の引数に `collectionMode` を追加:

```typescript
export interface UseImportReturn {
  // ... 既存
  startImport: (
    parseResult: ParseResult,
    duplicateStrategy: DuplicateStrategy,
    collectionMode?: ImportCollectionMode, // 追加。デフォルト "folder-inherit"
  ) => Promise<ImportResult>;
}
```

**Flat モード時の動作変更:**
- `collectionMode === "flat"` の場合、Collection 作成ループ（`sortedPaths` のイテレーション）をスキップ
- `assignBookmarkToCollection` の呼び出しをスキップ（collectionId を null のまま保持）
- ImportResult の `createdCollections` は 0 を返す

### 5. EnrichmentProgressBar コンポーネント (`src/components/ai/EnrichmentProgressBar.tsx`)

```typescript
interface EnrichmentProgressBarProps {
  progress: EnrichmentQueueProgress | null;
}

export function EnrichmentProgressBar({ progress }: EnrichmentProgressBarProps) {
  if (!progress || !progress.isProcessing) return null;

  const percentage = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className={styles.enrichmentProgress} role="progressbar" aria-valuenow={percentage}>
      <div className={styles.progressBar} style={{ width: `${percentage}%` }} />
      <span className={styles.progressText}>
        AI 補完中: {progress.completed}/{progress.total}
        {progress.failed > 0 && ` (${progress.failed} 件失敗)`}
      </span>
    </div>
  );
}
```

配置場所: `page.tsx` のメインコンテンツエリア上部（BookmarkToolbar の直下）に非侵入的に表示。

### 6. suggestedCollection の適用ロジック

`applyEnrichmentResult` 関数（page.tsx 内）:

```typescript
const applyEnrichmentResult = useCallback((itemResult: EnrichmentItemResult) => {
  const { bookmarkId, enrichmentResult, hasCollectionId } = itemResult;
  if (!enrichmentResult) return;

  const updates: Record<string, string> = {};
  if (enrichmentResult.suggestedTitle) updates.title = enrichmentResult.suggestedTitle;
  if (enrichmentResult.suggestedDescription) updates.description = enrichmentResult.suggestedDescription;
  if (enrichmentResult.suggestedMemo) updates.memo = enrichmentResult.suggestedMemo;

  // suggestedCollection の適用: hasCollectionId が false の場合のみ
  if (!hasCollectionId && enrichmentResult.suggestedCollection) {
    const matchedCollection = collections.find(
      (c) => c.name === enrichmentResult.suggestedCollection,
    );
    if (matchedCollection) {
      updates.collectionId = matchedCollection.id;
    }
    // マッチしない場合は collectionId を設定しない（null のまま）
  }

  if (Object.keys(updates).length > 0) {
    updateBookmark(bookmarkId, updates);
  }

  // suggestedTags の適用
  if (enrichmentResult.suggestedTags?.length > 0) {
    (async () => {
      for (const tagName of enrichmentResult.suggestedTags) {
        if (!tagName.trim()) continue;
        try {
          const tagId = await resolveTagId(tagName.trim());
          await addTagToBookmark(tagId, bookmarkId);
        } catch (e) {
          console.warn(`[AI] Tag "${tagName}" の付与に失敗:`, e);
        }
      }
    })();
  }
}, [collections, updateBookmark, resolveTagId, addTagToBookmark]);
```

## Data Models

### 新規型定義 (`src/lib/ai/types.ts` に追加)

```typescript
/** インポート時の Collection 取り扱いモード */
export type ImportCollectionMode = "folder-inherit" | "flat";
```

### 既存モデルへの影響

- **Bookmark モデル**: 変更なし。`collectionId` フィールドは既に nullable
- **Collection モデル**: 変更なし
- **EnrichmentResult**: 変更なし。`suggestedCollection` フィールドは既存

### 状態管理

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `enrichmentQueueRef` | page.tsx (useRef) | EnrichmentQueue インスタンス |
| `enrichmentProgress` | page.tsx (useState) | キューの進捗情報 |
| `collectionMode` | ImportDialog (useState) | インポート時の Collection モード選択 |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: All enqueued items are processed

*For any* set of N enrichment requests enqueued into the EnrichmentQueue, all N items SHALL be processed (either successfully or with a logged failure), and none SHALL be aborted due to subsequent enqueue operations.

**Validates: Requirements 1.1**

### Property 2: Concurrency invariant

*For any* state of the EnrichmentQueue during processing, the number of simultaneously in-flight requests SHALL never exceed the configured concurrency limit (3).

**Validates: Requirements 1.2**

### Property 3: Dynamic enqueue preserves processing

*For any* EnrichmentQueue that is actively processing items, when a new item is enqueued, it SHALL be appended to the queue and eventually processed without affecting the processing of existing items.

**Validates: Requirements 1.3**

### Property 4: Error isolation

*For any* EnrichmentQueue containing N items where item K fails (1 ≤ K ≤ N), all items other than K SHALL still be processed to completion.

**Validates: Requirements 1.5**

### Property 5: Completion signal accuracy

*For any* EnrichmentQueue that has processed all items, the completion signal SHALL report totalProcessed equal to the total number of items enqueued, and failedCount equal to the number of items that returned errors.

**Validates: Requirements 1.6, 6.4**

### Property 6: Bookmark update on enrichment completion

*For any* bookmark that completes AI enrichment successfully, the system SHALL update the corresponding Bookmark_Record with the non-empty fields from the EnrichmentResult (suggestedTitle, suggestedDescription, suggestedMemo, suggestedTags).

**Validates: Requirements 2.3**

### Property 7: Folder-mode enrichment preserves collectionId

*For any* bookmark that has a collectionId assigned by Folder_Inherit_Mode, the AI enrichment process SHALL NOT overwrite the collectionId with suggestedCollection, but SHALL still apply suggestedTags, suggestedMemo, suggestedTitle, and suggestedDescription.

**Validates: Requirements 4.2, 4.3**

### Property 8: Flat-mode initial state

*For any* set of bookmarks imported with Flat_Import_Mode, all Bookmark_Records SHALL have collectionId set to null immediately after import (before AI enrichment).

**Validates: Requirements 5.1**

### Property 9: Collection resolution from suggestedCollection

*For any* bookmark without a collectionId and an EnrichmentResult containing a non-empty suggestedCollection, if the suggestedCollection matches an existing Collection_Record name, the system SHALL set the bookmark's collectionId to that Collection_Record's id.

**Validates: Requirements 5.2, 5.3, 7.3**

### Property 10: Non-matching suggestedCollection leaves collectionId null

*For any* bookmark without a collectionId and an EnrichmentResult containing a suggestedCollection that does NOT match any existing Collection_Record name, the system SHALL leave the bookmark's collectionId as null.

**Validates: Requirements 5.4**

## Error Handling

| エラーケース | 対応方針 |
|-------------|----------|
| 個別 AI enrichment API 失敗 | `console.warn` でログし、そのアイテムをスキップして次へ進む。`onItemComplete` に `enrichmentResult: null` を渡す |
| ネットワークエラー（fetch 失敗） | 個別失敗と同じ扱い。リトライは行わない（API 側が Graceful Degradation で空結果を返すため） |
| AbortSignal による中断 | `AbortError` は無視し、残りのキューアイテムの処理を停止。`onComplete` は呼び出さない |
| BEDROCK_MODEL_ID 未設定 | API が空の EnrichmentResult を返すため、キュー側では正常完了扱い（フィールド更新なし） |
| Import 中に AI Toggle が OFF | `triggerOGPFetch` 内で `isAIEnabled` をチェックし、OFF なら enqueue しない |
| コンポーネントアンマウント | `useEffect` の cleanup で `queue.abort()` を呼び出し、全 pending リクエストを中断 |

## Testing Strategy

### Property-Based Tests (fast-check)

Property-based テストライブラリとして [fast-check](https://github.com/dubzzz/fast-check) を使用する。各プロパティテストは最低 100 イテレーション実行する。

**対象モジュール:** `src/lib/ai/enrichmentQueue.ts`

テスト対象のプロパティ:
- Property 1-5: EnrichmentQueue の内部動作（キューイング、コンカレンシー、エラーハンドリング）
- Property 7-10: `applyEnrichmentResult` のロジック（collectionId の適用/非適用）

各テストには以下のタグコメントを付与:
```typescript
// Feature: ai-enrichment-batch-import, Property 1: All enqueued items are processed
```

### Unit Tests (Jest/Vitest)

- EnrichmentQueue: 単件処理、バッチ処理、abort 動作
- ImportDialog: collectionMode ラジオボタンの表示・選択・デフォルト値
- useImport: flat モード時の Collection 作成スキップ
- applyEnrichmentResult: suggestedCollection の適用条件分岐

### Integration Tests

- QuickAdd → OGP → enqueue → API → updateBookmark の E2E フロー
- Import → OGP → enqueue(batch) → API → updateBookmark の E2E フロー
- AI Toggle OFF 時のスキップ動作
