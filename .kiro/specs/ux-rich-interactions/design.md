# Design Document: UX Rich Interactions

## Architecture Overview

本機能は既存の Rich Browser Link アプリケーションに 5 つのリッチインタラクション機能を追加する。アーキテクチャは既存のパターン（カスタムフック + コンポーネント + Amplify Data）を踏襲し、以下のレイヤーで構成する。

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (Components)                                   │
│  BookmarkCard / BookmarkList / CollectionList            │
│  + DndContext / SortableContext / DragOverlay            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Logic Layer (Hooks)                                     │
│  useBookmarks (拡張) / useDragAndDrop (新規)            │
│  useSort (拡張) / usePinning (新規)                     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Data Layer (Amplify Gen 2)                              │
│  Bookmark model + isReadable / sortOrder / pinned        │
└─────────────────────────────────────────────────────────┘
```

### 技術選定

| 領域 | 技術 | 理由 |
|------|------|------|
| ドラッグ&ドロップ | `@dnd-kit/core` + `@dnd-kit/sortable` | React 19 対応、アクセシビリティ内蔵、軽量 |
| スタイリング | CSS Modules | 既存プロジェクトのパターンに準拠 |
| データ永続化 | Amplify Gen 2 Data (DynamoDB) | 既存インフラを活用 |
| テスト | Vitest + fast-check | 既存テスト基盤を活用 |

---

## Data Model Changes

### Amplify Data Schema 変更

`amplify/data/resource.ts` の Bookmark モデルに以下のフィールドを追加する:

```typescript
Bookmark: a
  .model({
    // ... 既存フィールド ...
    // --- UX Rich Interactions フィールド ---
    isReadable: a.boolean().default(false),   // 読み物系フラグ
    sortOrder: a.integer().default(0),         // リスト並び順
    pinned: a.boolean().default(false),        // ピン留めフラグ
    // --- ここまで ---
  })
  .authorization((allow) => [allow.owner()]),
```

### TypeScript 型定義変更

`src/types/index.ts` の `Bookmark` インターフェースに追加:

```typescript
export interface Bookmark {
  // ... 既存フィールド ...
  isReadable: boolean;
  sortOrder: number;
  pinned: boolean;
}
```

### 後方互換性

既存レコードには新フィールドが存在しない（`null`/`undefined`）。マッピング関数 `mapRecordToBookmark` で以下のデフォルト値に正規化する:

- `isReadable`: `false`
- `sortOrder`: `0`
- `pinned`: `false`

---

## Components

### 新規コンポーネント

#### `DndProvider`

ドラッグ&ドロップのコンテキストを提供するラッパーコンポーネント。

```typescript
// src/components/dnd/DndProvider.tsx
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";

interface DndProviderProps {
  children: React.ReactNode;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}
```

#### `SortableBookmarkList`

リスト表示モード時にソート可能なブックマーク一覧を提供する。

```typescript
// src/components/bookmark/SortableBookmarkList.tsx
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface SortableBookmarkListProps extends BookmarkListProps {
  /** ドラッグによる並び替えが有効か */
  isSortable: boolean;
}
```

#### `SortableBookmarkItem`

個々のブックマークカードをソート可能にするラッパー。

```typescript
// src/components/bookmark/SortableBookmarkItem.tsx
import { useSortable } from "@dnd-kit/sortable";

interface SortableBookmarkItemProps {
  id: string;
  children: React.ReactNode;
}
```

#### `DroppableCollection`

コレクションサイドバーの各項目をドロップターゲットにするラッパー。

```typescript
// src/components/collection/DroppableCollection.tsx
import { useDroppable } from "@dnd-kit/core";

interface DroppableCollectionProps {
  collectionId: string;
  children: React.ReactNode;
  isOver: boolean;
}
```

### 既存コンポーネント変更

#### `BookmarkCard` 変更点

1. `isReadable` に基づく StatusSelector の条件表示
2. ピン留めアイコン/バッジの表示
3. アクションメニューに「読み物系」トグルと「ピン留め」アクションを追加
4. 最近アクセスのハイライト（左ボーダー）

```typescript
// BookmarkCard に追加する props
interface BookmarkCardProps {
  // ... 既存 props ...
  onToggleReadable: (id: string) => void;
  onTogglePin: (id: string) => void;
}
```

#### `BookmarkList` 変更点

1. `SortableContext` でラップ（リスト表示モード時のみ）
2. ピン留めブックマークを上部に表示するソート適用

#### `CollectionList` 変更点

1. 各コレクション項目を `DroppableCollection` でラップ
2. ドラッグオーバー時のハイライトスタイル適用

---

## Hooks

### 新規フック

#### `useDragAndDrop`

ドラッグ&ドロップの状態管理を一元化するフック。

```typescript
// src/hooks/useDragAndDrop.ts
export interface UseDragAndDropReturn {
  /** 現在ドラッグ中の Bookmark ID（null = ドラッグ中でない） */
  activeId: string | null;
  /** ドラッグオーバー中のコレクション ID */
  overCollectionId: string | null;
  /** DndContext のイベントハンドラ */
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  /** 重複通知メッセージ（null = 通知なし） */
  duplicateNotification: string | null;
  dismissNotification: () => void;
}

export function useDragAndDrop(options: {
  bookmarks: Bookmark[];
  collections: Collection[];
  displayMode: DisplayMode;
  addBookmarkToCollection: (bookmarkId: string, collectionId: string) => Promise<void>;
  checkBookmarkInCollection: (bookmarkId: string, collectionId: string) => Promise<boolean>;
  onReorder: (bookmarkId: string, newIndex: number) => void;
}): UseDragAndDropReturn;
```

#### `usePinning`

ピン留め状態の管理とソート適用を提供するフック。

```typescript
// src/hooks/usePinning.ts
export interface UsePinningReturn {
  /** ピン留めトグル */
  togglePin: (bookmarkId: string) => Promise<void>;
  /** ピン留めを考慮したソート関数 */
  sortWithPinning: (bookmarks: Bookmark[]) => Bookmark[];
}

export function usePinning(options: {
  updateBookmark: (id: string, input: Partial<BookmarkInput>) => Promise<Bookmark>;
}): UsePinningReturn;
```

### 既存フック変更

#### `useBookmarks` 変更点

1. `mapRecordToBookmark` に `isReadable`, `sortOrder`, `pinned` のマッピング追加
2. `updateBookmark` で新フィールドの更新をサポート
3. `reorderBookmarks` メソッド追加（sortOrder の一括更新）

```typescript
// useBookmarks に追加するメソッド
export interface UseBookmarksReturn {
  // ... 既存 ...
  toggleReadable: (id: string) => Promise<void>;
  reorderBookmarks: (bookmarkId: string, newIndex: number) => Promise<void>;
}
```

#### `useSort` 変更点

1. `SortKey` 型に `"sortOrder"` を追加
2. `sortOrder` が選択されている場合は昇順ソート
3. デフォルトソートキーを `"sortOrder"` に変更（他のソートキーが未選択時）

```typescript
export type SortKey = "createdAt" | "lastAccessedAt" | "accessCount" | "sortOrder";
```

---

## Key Algorithms

### sortOrder 再計算アルゴリズム

ブックマークの並び替え時に `sortOrder` を再計算する。隣接する要素の中間値を使用し、衝突時のみ全体を再番号付けする。

```typescript
/**
 * ブックマークを新しい位置に移動した際の sortOrder を計算する。
 *
 * 戦略:
 * 1. 移動先の前後の sortOrder の中間値を使用
 * 2. 中間値が整数にならない場合や衝突する場合は、全体を等間隔で再番号付け
 *
 * @param bookmarks - 現在の並び順のブックマーク配列
 * @param fromIndex - 移動元のインデックス
 * @param toIndex - 移動先のインデックス
 * @returns 更新が必要な { id, sortOrder } の配列
 */
function calculateNewSortOrders(
  bookmarks: Bookmark[],
  fromIndex: number,
  toIndex: number,
): Array<{ id: string; sortOrder: number }>;
```

### 最近アクセス判定ロジック

```typescript
/**
 * ブックマークが最近アクセスされたかを判定する。
 *
 * @param lastAccessedAt - ISO 8601 形式の最終アクセス日時（空文字 = 未アクセス）
 * @param now - 現在時刻（テスト容易性のため注入可能）
 * @returns 24 時間以内にアクセスされた場合 true
 */
function isRecentlyAccessed(lastAccessedAt: string, now?: Date): boolean {
  if (!lastAccessedAt) return false;
  const accessedTime = new Date(lastAccessedAt).getTime();
  const currentTime = (now ?? new Date()).getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return currentTime - accessedTime < TWENTY_FOUR_HOURS_MS;
}
```

### ピン留めソートロジック

```typescript
/**
 * ピン留めを考慮してブックマーク配列をソートする。
 * pinned=true のアイテムを先頭に、それぞれのグループ内では元の順序を維持する。
 *
 * @param bookmarks - ソート対象のブックマーク配列
 * @returns ピン留め優先でソートされた配列
 */
function sortWithPinning(bookmarks: Bookmark[]): Bookmark[] {
  const pinned = bookmarks.filter((b) => b.pinned);
  const unpinned = bookmarks.filter((b) => !b.pinned);
  return [...pinned, ...unpinned];
}
```

---

## OGP Preview Positioning

既存の `OGPPreviewCard` コンポーネントを拡張し、ビューポート境界を考慮したポジショニングを追加する。

```typescript
/**
 * OGPPreviewCard の表示位置を計算する。
 * カードがビューポートからはみ出す場合は反対側に表示する。
 *
 * @param cardRect - BookmarkCard の DOMRect
 * @param previewSize - プレビューカードの想定サイズ
 * @param viewport - ビューポートサイズ
 * @returns CSS の top/left 値
 */
function calculatePreviewPosition(
  cardRect: DOMRect,
  previewSize: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number };
```

---

## Error Handling

| シナリオ | 対応 |
|----------|------|
| ドラッグ中にネットワークエラー | ドラッグをキャンセルし、トースト通知でエラー表示 |
| sortOrder 更新失敗 | 楽観的 UI をロールバックし、元の順序に戻す |
| isReadable/pinned 更新失敗 | 楽観的 UI をロールバックし、コンソールにエラーログ |
| 重複コレクション割り当て | 通知メッセージを表示し、操作をキャンセル |

---

## File Structure

```
src/
├── components/
│   ├── bookmark/
│   │   ├── BookmarkCard.tsx          (変更)
│   │   ├── BookmarkCard.module.css   (変更)
│   │   ├── BookmarkList.tsx          (変更)
│   │   ├── SortableBookmarkList.tsx  (新規)
│   │   ├── SortableBookmarkItem.tsx  (新規)
│   │   └── OGPPreviewCard.tsx        (変更: ポジショニング)
│   ├── collection/
│   │   ├── CollectionList.tsx        (変更)
│   │   └── DroppableCollection.tsx   (新規)
│   └── dnd/
│       └── DndProvider.tsx           (新規)
├── hooks/
│   ├── useBookmarks.ts              (変更)
│   ├── useDragAndDrop.ts            (新規)
│   ├── usePinning.ts                (新規)
│   └── useSort.ts                   (変更)
├── lib/
│   ├── sortOrderUtils.ts            (新規: sortOrder 再計算)
│   ├── recentAccessUtils.ts         (新規: 最近アクセス判定)
│   └── pinningUtils.ts              (新規: ピン留めソート)
└── types/
    └── index.ts                     (変更)

amplify/
└── data/
    └── resource.ts                  (変更: スキーマ追加)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: isReadable toggle is idempotent round-trip

*For any* Bookmark, toggling `isReadable` twice should return the field to its original value. That is, `toggle(toggle(bookmark)).isReadable === bookmark.isReadable`.

**Validates: Requirements 1.2**

### Property 2: StatusSelector visibility equals isReadable

*For any* Bookmark, the StatusSelector component is rendered on the BookmarkCard if and only if `bookmark.isReadable === true`. Equivalently, `isStatusSelectorVisible(bookmark) === bookmark.isReadable`.

**Validates: Requirements 1.3, 1.4**

### Property 3: Drag-to-collection creates association

*For any* Bookmark and *any* Collection where the Bookmark is not already associated with that Collection, dropping the Bookmark onto the Collection should result in exactly one new BookmarkCollection record linking them.

**Validates: Requirements 2.3**

### Property 4: Duplicate collection assignment is rejected

*For any* Bookmark that is already associated with a given Collection, attempting to assign it to the same Collection again should produce no new BookmarkCollection record and should trigger a duplicate notification.

**Validates: Requirements 2.5**

### Property 5: Cancelled drag preserves state

*For any* bookmark list state and *any* drag operation that is cancelled (released outside a valid drop target), the bookmark list and all BookmarkCollection associations should remain identical to their state before the drag began.

**Validates: Requirements 2.6**

### Property 6: Reorder produces monotonically increasing sortOrder

*For any* list of Bookmarks and *any* valid move operation (moving a bookmark from index `i` to index `j`), the resulting `sortOrder` values should be strictly monotonically increasing when the list is sorted by `sortOrder`.

**Validates: Requirements 3.3**

### Property 7: Default sort by sortOrder ascending

*For any* list of Bookmarks with assigned `sortOrder` values, when no other sort key is active, rendering the list should produce an order where `bookmarks[n].sortOrder <= bookmarks[n+1].sortOrder` for all valid indices `n`.

**Validates: Requirements 3.6**

### Property 8: Recently accessed highlight correctness

*For any* Bookmark and *any* reference time `now`, `isRecentlyAccessed(bookmark.lastAccessedAt, now)` returns `true` if and only if `lastAccessedAt` is non-empty and `now - parseTime(lastAccessedAt) < 24 hours`.

**Validates: Requirements 5.1, 5.3**

### Property 9: Pinned items always sort above unpinned

*For any* list of Bookmarks containing at least one pinned and one unpinned item, after applying `sortWithPinning`, every pinned Bookmark should appear at an index lower than every unpinned Bookmark. Formally: `∀ p ∈ pinned, ∀ u ∈ unpinned: indexOf(p) < indexOf(u)`.

**Validates: Requirements 6.4**

### Property 10: Pin toggle correctness

*For any* Bookmark, `togglePin(bookmark)` should produce a Bookmark where `pinned` is the logical negation of the original value. That is, `togglePin(bookmark).pinned === !bookmark.pinned`.

**Validates: Requirements 6.2, 6.3**

### Property 11: Backward compatibility mapping preserves defaults

*For any* Amplify Data record where `isReadable`, `sortOrder`, or `pinned` fields are `null` or `undefined`, the `mapRecordToBookmark` function should produce a Bookmark with `isReadable === false`, `sortOrder === 0`, and `pinned === false`.

**Validates: Requirements 7.4**
