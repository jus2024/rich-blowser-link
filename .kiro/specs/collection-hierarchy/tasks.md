# Implementation Plan: Collection 階層構造対応

## Overview

Collection を最大3段の階層構造に対応させ、Bookmark の Collection 所属を多対多から1対1に変更する。
あわせてブラウザブックマークインポート時にフォルダ階層を維持して取り込めるようにする。

## Tasks

- [ ] 1. Amplify スキーマと型定義の変更
  - [ ] 1.1 `amplify/data/resource.ts` に `parentId` と `collectionId` を追加
    - `Collection` モデルに `parentId: a.id()` を追加（null = ルート）
    - `Bookmark` モデルに `collectionId: a.id()` を追加（null = 未分類）
    - _Requirements: 1.2, 2.1_

  - [ ] 1.2 `src/types/index.ts` を更新
    - `Collection` に `parentId: string | null` を追加
    - `CollectionInput` に `parentId?: string | null` を追加
    - `Bookmark` に `collectionId: string | null` を追加
    - `BookmarkInput` に `collectionId?: string | null` を追加
    - `CollectionNode` インターフェースを新規追加（`children`, `depth` フィールド）
    - _Requirements: 1.2, 2.1_

- [ ] 2. ユーティリティ関数の変更
  - [ ] 2.1 `src/lib/collectionUtils.ts` を更新
    - `buildCollectionTree(collections)` を追加: フラット配列 → ツリー構造
    - `filterBookmarksByCollectionId(bookmarks, collectionId)` を追加: `collectionId` フィールドでフィルタ
    - `getCollectionDepth(collectionId, collectionsById)` を追加: 深さ計算（最大3）
    - 既存の `filterBookmarksByCollection`（BookmarkCollection 中間テーブル版）は残す
    - _Requirements: 1.1, 2.5, 4.4_

- [ ] 3. Checkpoint - スキーマ・型・ユーティリティの検証
  - sandbox を再起動して新フィールドが反映されることを確認
  - `npx tsc --noEmit` でエラーがないことを確認

- [ ] 4. フックの変更
  - [ ] 4.1 `useCollections.ts` を更新
    - `mapCollection` に `parentId` マッピングを追加
    - `collectionTree` を `useMemo` で計算して返す
    - `createCollection` で `parentId` を受け取れるよう変更
    - 深さ3超の Collection 作成を拒否するバリデーションを追加
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ] 4.2 `useBookmarks.ts` を更新
    - `mapRecordToBookmark` に `collectionId: record.collectionId ?? null` を追加
    - `updateBookmark` で `collectionId` の更新をサポート
    - _Requirements: 2.1, 2.3_

- [ ] 5. CollectionAssignDialog の変更
  - [ ] 5.1 チェックボックス → ラジオボタンに変更
    - 「未分類」選択肢を先頭に追加
    - 選択後即時 `updateBookmark({ collectionId })` を呼び出す
    - ツリー構造を反映したインデント表示
    - `onAdd` / `onRemove` props を `onAssign: (collectionId: string | null) => Promise<void>` に変更
    - _Requirements: 2.2, 2.3_

- [ ] 6. CollectionList のツリー表示
  - [ ] 6.1 `CollectionList.tsx` をツリー表示に変更
    - `CollectionTreeNode` サブコンポーネントを追加（展開/折りたたみ対応）
    - `depth * 1rem` のインデントスタイルを適用
    - 各ノードに `DroppableCollection` を適用
    - 件数表示を `collectionId` ベースに変更
    - _Requirements: 1.6, 4.1, 4.2, 4.3, 4.5_

  - [ ] 6.2 `CollectionList.module.css` にインデントスタイルを追加
    - _Requirements: 4.2_

- [ ] 7. CollectionForm の変更
  - [ ] 7.1 `CollectionForm.tsx` に親 Collection 選択を追加
    - `collections` prop を受け取り、親 Collection のドロップダウンを表示
    - 深さ3超になる親は選択肢から除外
    - _Requirements: 1.4, 1.5_

- [ ] 8. インポート機能の変更
  - [ ] 8.1 `src/lib/import/bookmarkParser.ts` を更新
    - `buildCollectionName` を削除（または非推奨化）
    - `truncateFolderPath(folderPath, maxDepth=3)` を追加
    - _Requirements: 3.1, 3.2_

  - [ ] 8.2 `useImport.ts` を更新
    - Collection 作成ロジックを階層対応に変更
      - `collectionByKey: Map<"parentId:name", id>` で管理
      - 親から子の順に作成
      - 3段を超えるパスは切り詰め
    - `linkBookmarkToCollection` を `updateBookmark({ collectionId })` に変更
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 9. page.tsx のフィルタロジック変更
  - [ ] 9.1 `filterBookmarksByCollection`（中間テーブル版）を `filterBookmarksByCollectionId` に切り替え
    - `bookmarkCollections` への依存を除去
    - `collectionCounts` / `uncategorizedCount` を `collectionId` フィールドベースに変更
    - _Requirements: 2.5, 2.6_

- [ ] 10. Final checkpoint - 全体検証
  - sandbox 再起動後に動作確認
  - インポートで階層が維持されることを確認
  - 振り分けダイアログでラジオボタン選択が機能することを確認

## Notes

- **sandbox 再起動必須**: `amplify/data/resource.ts` 変更後に `npx ampx sandbox` を再起動すること
- 既存データは再インポートで対応（移行スクリプト不要）
- `BookmarkCollection` テーブルはスキーマに残すが、新規割り当てには使わない
- インポート時の Collection 作成は「親から子の順」で行う必要がある（親 ID が必要なため）
