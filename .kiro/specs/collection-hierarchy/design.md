# Design: Collection 階層構造対応

## 変更概要

| レイヤー | 変更内容 |
|---|---|
| Amplify スキーマ | Collection に `parentId` 追加、Bookmark に `collectionId` 追加 |
| TypeScript 型 | `Collection` / `Bookmark` / `CollectionInput` を更新 |
| フック | `useCollections` を階層対応に拡張、`useBookmarks` の create/update に `collectionId` 追加 |
| ユーティリティ | `collectionUtils.ts` にツリー構築・フィルタ関数を追加 |
| コンポーネント | `CollectionList` をツリー表示に変更、`CollectionAssignDialog` を1対1選択に変更 |
| インポート | `useImport` / `bookmarkParser` を階層 Collection 対応に変更 |

---

## Amplify スキーマ変更

```typescript
// amplify/data/resource.ts

Collection: a.model({
  name: a.string().required(),
  description: a.string().default(""),
  parentId: a.id(),                          // 追加: null = ルート
  bookmarks: a.hasMany("BookmarkCollection", "collectionId"),
}).authorization((allow) => [allow.owner()]),

Bookmark: a.model({
  // ... 既存フィールド ...
  collectionId: a.id(),                      // 追加: null = 未分類（1対1）
  // ... UX Rich Interactions フィールド ...
}).authorization((allow) => [allow.owner()]),
```

**注意:** `BookmarkCollection` テーブルは後方互換のためスキーマに残すが、新規の割り当てには使わない。

---

## 型定義変更

```typescript
// src/types/index.ts

export interface Collection {
  id: string;
  name: string;
  description: string;
  parentId: string | null;   // 追加
  owner: string;
}

export interface CollectionInput {
  name: string;
  description?: string;
  parentId?: string | null;  // 追加
}

export interface Bookmark {
  // ... 既存フィールド ...
  collectionId: string | null;  // 追加
}

export interface BookmarkInput {
  // ... 既存フィールド ...
  collectionId?: string | null; // 追加
}

/** ツリー表示用の Collection ノード */
export interface CollectionNode extends Collection {
  children: CollectionNode[];
  depth: number;  // 0 = ルート, 1 = 子, 2 = 孫
}
```

---

## collectionUtils.ts 変更

```typescript
/**
 * フラットな Collection 配列からツリー構造を構築する。
 * 深さ3段（depth 0/1/2）まで。
 */
export function buildCollectionTree(collections: Collection[]): CollectionNode[]

/**
 * collectionId フィールドで Bookmark をフィルタする（1対1版）。
 * collectionId === null → 未分類
 */
export function filterBookmarksByCollectionId(
  bookmarks: Bookmark[],
  collectionId: string | null,
): Bookmark[]

/**
 * Collection の深さを返す（0 = ルート）。
 * 循環参照防止のため最大深さ 3 で打ち切る。
 */
export function getCollectionDepth(
  collectionId: string,
  collectionsById: Map<string, Collection>,
): number
```

---

## CollectionList コンポーネント変更

```
CollectionList
├── 「すべて」ボタン
├── 「未分類」ボタン（件数付き）
└── ルート Collection のツリー
    ├── CollectionTreeNode（depth=0）
    │   ├── 展開/折りたたみボタン
    │   ├── Collection 名 + 件数
    │   └── 子 CollectionTreeNode（depth=1）
    │       └── 孫 CollectionTreeNode（depth=2）
    └── ...
```

- 各ノードは `isExpanded` 状態を持つ（デフォルト: 展開）
- インデントは `depth * 1rem` で表現
- ドロップターゲット（`DroppableCollection`）は各ノードに適用

---

## CollectionAssignDialog 変更

- チェックボックス（多対多）→ ラジオボタン（1対1）に変更
- 「未分類」選択肢を先頭に追加
- 選択後即時 `updateBookmark({ collectionId })` を呼び出す
- ツリー構造を反映したインデント表示

---

## useCollections 変更

```typescript
export interface UseCollectionsReturn {
  collections: Collection[];
  collectionTree: CollectionNode[];           // 追加
  bookmarkCollections: BookmarkCollection[];  // 後方互換のため残す
  createCollection: (input: CollectionInput) => Promise<Collection>;
  // ... 既存メソッド ...
}
```

- `collectionTree` は `buildCollectionTree(collections)` の結果を `useMemo` で計算

---

## useImport 変更

### 階層 Collection 作成ロジック

```
folderPath = ["Bookmarks Bar", "Tech", "React", "Hooks"]
→ 3段に切り詰め: ["Bookmarks Bar", "Tech", "React"]

作成順序（親から子へ）:
1. "Bookmarks Bar" (parentId: null)
2. "Tech" (parentId: id of "Bookmarks Bar")
3. "React" (parentId: id of "Tech")

Bookmark の collectionId = id of "React"
```

### collectionByKey の変更

```typescript
// 変更前: Map<name, id>
// 変更後: Map<"parentId:name", id>  ← 同名の Collection が別階層に存在できるため
type CollectionKey = `${string | "root"}:${string}`;
```

---

## インポート時の階層深さ制限

```typescript
const MAX_IMPORT_DEPTH = 3;

function truncateFolderPath(folderPath: string[]): string[] {
  return folderPath.slice(0, MAX_IMPORT_DEPTH);
}
```

---

## 変更ファイル一覧

```
amplify/
└── data/resource.ts                    変更: parentId, collectionId 追加

src/
├── types/index.ts                      変更: Collection, Bookmark, CollectionInput, CollectionNode 追加
├── lib/
│   └── collectionUtils.ts              変更: buildCollectionTree, filterBookmarksByCollectionId 追加
│   └── import/
│       └── bookmarkParser.ts           変更: buildCollectionName 削除、階層対応ロジック追加
├── hooks/
│   ├── useCollections.ts               変更: collectionTree, parentId 対応
│   └── useImport.ts                    変更: 階層 Collection 作成、collectionId 設定
└── components/
    ├── collection/
    │   ├── CollectionList.tsx          変更: ツリー表示
    │   ├── CollectionList.module.css   変更: インデントスタイル
    │   ├── CollectionAssignDialog.tsx  変更: ラジオボタン、ツリー表示
    │   └── CollectionForm.tsx          変更: parentId 選択を追加
    └── app/page.tsx                    変更: collectionId ベースのフィルタに切り替え
```

---

## sandbox 再起動について

`amplify/data/resource.ts` を変更するため、**`npx ampx sandbox` の再起動が必要**。
既存データは再インポートで対応。
