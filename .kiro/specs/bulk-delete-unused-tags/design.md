# Design Document: Bulk Delete Unused Tags

## Overview

本機能は、左サイドバーの Tags セクションにおいて `bookmarkCount === 0` のタグをまとめて一括削除する機能を追加する。既存の useTags フックに `deleteUnusedTags()` メソッドを追加し、TagFilter コンポーネントのヘッダーに一括削除ボタンを配置する。確認ダイアログには `window.confirm` を使用し、新しいライブラリは導入しない。

## Architecture

本機能は既存の TagFilter コンポーネントと useTags フックを拡張し、`bookmarkCount === 0` のタグを一括削除する機能を追加する。アーキテクチャは既存パターン（props 経由のハンドラ注入 + フック内ロジック）を踏襲する。

```
page.tsx
  └─ useTags() → deleteUnusedTags() を取得
  └─ TagFilter(onDeleteUnusedTags, unusedTagCount, ...)
       └─ BulkDeleteButton（ヘッダー内）
       └─ ConfirmationDialog（window.confirm）
```

データフロー:
1. `useTags` フックが `tags` (TagWithCount[]) から未使用タグ数を算出
2. `page.tsx` が `deleteUnusedTags` メソッドと `unusedTagCount` を TagFilter に props として渡す
3. TagFilter がボタンの有効/無効状態を `unusedTagCount` で制御
4. ユーザーがボタンをクリック → `window.confirm` で確認 → `onDeleteUnusedTags()` を呼び出し
5. `useTags.deleteUnusedTags()` が内部で各未使用タグに対して既存の `deleteTag` を順次実行

## Components and Interfaces

### 1. useTags フック拡張

**ファイル:** `src/hooks/useTags.ts`

既存の `UseTagsReturn` インターフェースに `deleteUnusedTags` メソッドを追加する。

```typescript
export interface UseTagsReturn {
  // ... 既存フィールド
  /** 未使用タグ（bookmarkCount === 0）を一括削除する */
  deleteUnusedTags: () => Promise<void>;
}
```

**実装方針:**
- `tags` (TagWithCount[]) から `bookmarkCount === 0` のものをフィルタ
- 各タグに対して既存の `deleteTag(id)` を順次呼び出し（`Promise.all` ではなく逐次実行で安定性を確保）
- エラー発生時は即座に throw して呼び出し元に伝播

```typescript
const deleteUnusedTags = useCallback(async (): Promise<void> => {
  if (!client) {
    throw new Error(NOT_CONFIGURED_MESSAGE);
  }
  const unusedTags = tags.filter((t) => t.bookmarkCount === 0);
  for (const tag of unusedTags) {
    await deleteTag(tag.id);
  }
}, [client, tags, deleteTag]);
```

### 2. TagFilter コンポーネント拡張

**ファイル:** `src/components/tag/TagFilter.tsx`

#### Props 拡張

```typescript
export interface TagFilterProps {
  // ... 既存 props
  /** 未使用タグ一括削除ハンドラ */
  onDeleteUnusedTags?: () => Promise<void>;
  /** 未使用タグの件数（ボタン状態・ダイアログメッセージに使用） */
  unusedTagCount?: number;
}
```

#### BulkDeleteButton

ヘッダー内に配置。`onDeleteUnusedTags` が未提供の場合は非表示。

```typescript
{onDeleteUnusedTags && (
  <button
    type="button"
    className={styles.bulkDeleteButton}
    disabled={unusedTagCount === 0 || isDeleting}
    onClick={handleBulkDelete}
    aria-label="未使用タグを一括削除"
  >
    {isDeleting ? "削除中..." : "一括削除"}
  </button>
)}
```

#### 確認ダイアログ

シンプルに `window.confirm` を使用する。新しいライブラリやモーダルコンポーネントは不要。

```typescript
const handleBulkDelete = useCallback(async () => {
  if (!onDeleteUnusedTags || unusedTagCount === 0) return;
  const confirmed = window.confirm(
    `${unusedTagCount}件の未使用タグを削除しますか？`
  );
  if (!confirmed) return;
  setIsDeleting(true);
  try {
    await onDeleteUnusedTags();
  } finally {
    setIsDeleting(false);
  }
}, [onDeleteUnusedTags, unusedTagCount]);
```

### 3. page.tsx 統合

**ファイル:** `src/app/page.tsx`

```typescript
const { tags, deleteUnusedTags, /* ... */ } = useTags();

// 未使用タグ数の算出
const unusedTagCount = useMemo(
  () => tags.filter((t) => t.bookmarkCount === 0).length,
  [tags],
);

// TagFilter への props 追加
<TagFilter
  tags={tags}
  selectedTagIds={selectedTagIds}
  onToggleTag={handleToggleTag}
  onClear={handleClearTags}
  onDeleteTag={deleteTag}
  onDeleteUnusedTags={deleteUnusedTags}
  unusedTagCount={unusedTagCount}
/>
```

## Interfaces

### UseTagsReturn（拡張後）

```typescript
export interface UseTagsReturn {
  tags: TagWithCount[];
  bookmarkTags: BookmarkTag[];
  suggestions: Tag[];
  getSuggestions: (prefix: string) => void;
  createTag: (name: string) => Promise<Tag>;
  renameTag: (id: string, newName: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  deleteUnusedTags: () => Promise<void>;  // 新規追加
  addTagToBookmark: (tagId: string, bookmarkId: string) => Promise<void>;
  removeTagFromBookmark: (tagId: string, bookmarkId: string) => Promise<void>;
  refresh: () => Promise<void>;
}
```

### TagFilterProps（拡張後）

```typescript
export interface TagFilterProps {
  tags: TagWithCount[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClear?: () => void;
  onDeleteTag?: (tagId: string) => Promise<void>;
  onDeleteUnusedTags?: () => Promise<void>;  // 新規追加
  unusedTagCount?: number;                    // 新規追加
  collapsedCount?: number;
}
```

## Data Models

既存のデータモデルに変更なし。本機能は既存の `Tag` モデルと `BookmarkTag` 中間テーブルの削除操作のみを行う。

- **Tag**: `{ id, name, owner }` — 削除対象
- **BookmarkTag**: `{ id, bookmarkId, tagId, owner }` — カスケード削除対象（既存 `deleteTag` が処理）
- **TagWithCount**: `Tag & { bookmarkCount: number }` — 未使用判定に使用

## Error Handling

| シナリオ | 対応 |
|---------|------|
| Amplify 未設定 | `deleteUnusedTags` が `"Amplify is not configured"` エラーを throw |
| 個別タグ削除失敗 | 逐次実行のため、失敗した時点で即座に throw。既に削除されたタグは復元しない（部分削除状態） |
| ネットワークエラー | Amplify Client のエラーがそのまま伝播 |
| 未使用タグが 0 件 | UI 側で disabled 制御。ロジック側でも空配列の場合は即座に return |

## Styling

**ファイル:** `src/components/tag/TagFilter.module.css`

既存の `.clearButton` スタイルに準じた `.bulkDeleteButton` を追加:

```css
.bulkDeleteButton {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.bulkDeleteButton:hover:not(:disabled) {
  color: #b91c1c;
}

.bulkDeleteButton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

## Testing Strategy

- **型チェック**: `tsc --noEmit` で Props インターフェース拡張の型安全性を検証
- **ユニットテスト**: TagFilter コンポーネントの描画テスト（ボタン表示/非表示、disabled 状態）
- **プロパティテスト**: `deleteUnusedTags` が正しいタグのみを削除することを多数の入力パターンで検証
- **手動テスト**: window.confirm の動作確認、削除中の UI フィードバック確認

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Button disabled state reflects unused tag count

*For any* `unusedTagCount` value, the BulkDeleteButton SHALL be disabled if and only if `unusedTagCount === 0`.

**Validates: Requirements 1.3, 1.4, 4.3**

### Property 2: Confirmation message contains correct count

*For any* positive integer `unusedTagCount`, the confirmation dialog message SHALL contain that exact number in the format `「{unusedTagCount}件の未使用タグを削除しますか？」`.

**Validates: Requirements 2.2**

### Property 3: deleteUnusedTags removes exactly the unused tags

*For any* list of `TagWithCount` where some tags have `bookmarkCount === 0`, calling `deleteUnusedTags` SHALL result in `deleteTag` being called exactly once for each tag with `bookmarkCount === 0`, and never for tags with `bookmarkCount > 0`.

**Validates: Requirements 3.1, 3.2**

### Property 4: Button visibility controlled by prop presence

*For any* TagFilter rendered without the `onDeleteUnusedTags` prop, the BulkDeleteButton SHALL not be present in the DOM.

**Validates: Requirements 5.3**
