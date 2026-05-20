# Implementation Plan: UX Rich Interactions

## Overview

既存の Rich Browser Link アプリケーションに 5 つのリッチインタラクション機能（読み物系ステータス導線、ドラッグ&ドロップによるコレクション割り当て・並び替え、OGP プレビュー、最近アクセスハイライト、ピン留め）を追加する。Amplify Data スキーマ変更 → ユーティリティ関数 → カスタムフック → コンポーネントの順に段階的に実装する。

## Tasks

- [x] 1. データモデル変更と型定義
  - [x] 1.1 Amplify Data スキーマに新フィールドを追加
    - `amplify/data/resource.ts` の Bookmark モデルに `isReadable` (boolean, default false), `sortOrder` (integer, default 0), `pinned` (boolean, default false) を追加
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.2 TypeScript 型定義を更新
    - `src/types/index.ts` の `Bookmark` インターフェースに `isReadable: boolean`, `sortOrder: number`, `pinned: boolean` を追加
    - _Requirements: 7.5_

  - [x] 1.3 `mapRecordToBookmark` に後方互換マッピングを追加
    - `useBookmarks` フック内の `mapRecordToBookmark` 関数で、`null`/`undefined` の新フィールドをデフォルト値に正規化する
    - _Requirements: 7.4_

  - [ ]* 1.4 後方互換マッピングのプロパティテスト
    - **Property 11: Backward compatibility mapping preserves defaults**
    - **Validates: Requirements 7.4**

- [x] 2. ユーティリティ関数の実装
  - [x] 2.1 `src/lib/sortOrderUtils.ts` を作成
    - `calculateNewSortOrders` 関数を実装: 移動先の前後の中間値を使用し、衝突時は全体を再番号付け
    - _Requirements: 3.3_

  - [ ]* 2.2 sortOrder 再計算のプロパティテスト
    - **Property 6: Reorder produces monotonically increasing sortOrder**
    - **Validates: Requirements 3.3**

  - [x] 2.3 `src/lib/recentAccessUtils.ts` を作成
    - `isRecentlyAccessed` 関数を実装: `lastAccessedAt` が 24 時間以内かを判定
    - _Requirements: 5.1, 5.3_

  - [ ]* 2.4 最近アクセス判定のプロパティテスト
    - **Property 8: Recently accessed highlight correctness**
    - **Validates: Requirements 5.1, 5.3**

  - [x] 2.5 `src/lib/pinningUtils.ts` を作成
    - `sortWithPinning` 関数を実装: pinned=true を先頭に、各グループ内は元の順序を維持
    - _Requirements: 6.4_

  - [ ]* 2.6 ピン留めソートのプロパティテスト
    - **Property 9: Pinned items always sort above unpinned**
    - **Validates: Requirements 6.4**

- [x] 3. Checkpoint - データモデルとユーティリティの検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. カスタムフックの実装
  - [x] 4.1 `useBookmarks` フックを拡張
    - `toggleReadable` メソッドを追加: `isReadable` フィールドのトグルと永続化
    - `reorderBookmarks` メソッドを追加: `sortOrder` の一括更新と永続化
    - `updateBookmark` で `isReadable`, `sortOrder`, `pinned` の更新をサポート
    - _Requirements: 1.2, 1.5, 3.3, 3.4_

  - [ ]* 4.2 isReadable トグルのプロパティテスト
    - **Property 1: isReadable toggle is idempotent round-trip**
    - **Validates: Requirements 1.2**

  - [x] 4.3 `src/hooks/usePinning.ts` を新規作成
    - `togglePin` メソッド: `pinned` フィールドのトグルと永続化
    - `sortWithPinning` メソッド: ピン留め優先ソートの適用
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.4 ピン留めトグルのプロパティテスト
    - **Property 10: Pin toggle correctness**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 4.5 `useSort` フックを拡張
    - `SortKey` 型に `"sortOrder"` を追加
    - デフォルトソートキーを `"sortOrder"` に変更（他のソートキーが未選択時）
    - `sortOrder` 選択時は昇順ソート
    - _Requirements: 3.6_

  - [ ]* 4.6 デフォルトソートのプロパティテスト
    - **Property 7: Default sort by sortOrder ascending**
    - **Validates: Requirements 3.6**

  - [x] 4.7 `src/hooks/useDragAndDrop.ts` を新規作成
    - `activeId`, `overCollectionId` の状態管理
    - `handleDragStart`, `handleDragOver`, `handleDragEnd`, `handleDragCancel` イベントハンドラ
    - コレクションへのドロップ時に `addBookmarkToCollection` を呼び出し
    - 重複チェックと通知メッセージ管理
    - リスト表示モード時の並び替え処理（`onReorder` 呼び出し）
    - _Requirements: 2.3, 2.5, 2.6, 3.2_

- [x] 5. Checkpoint - フック層の検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. ドラッグ&ドロップコンポーネントの実装
  - [x] 6.1 `src/components/dnd/DndProvider.tsx` を新規作成
    - `@dnd-kit/core` の `DndContext`, `DragOverlay`, `closestCenter` を使用
    - ドラッグイベントハンドラを props で受け取り、子コンポーネントにコンテキストを提供
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 `src/components/bookmark/SortableBookmarkItem.tsx` を新規作成
    - `@dnd-kit/sortable` の `useSortable` を使用
    - ドラッグハンドルとトランスフォームスタイルの適用
    - _Requirements: 3.2_

  - [x] 6.3 `src/components/bookmark/SortableBookmarkList.tsx` を新規作成
    - `SortableContext` + `verticalListSortingStrategy` でブックマーク一覧をラップ
    - `isSortable` prop でリスト表示モード時のみソート有効化
    - _Requirements: 3.2, 3.5_

  - [x] 6.4 `src/components/collection/DroppableCollection.tsx` を新規作成
    - `@dnd-kit/core` の `useDroppable` を使用
    - ドラッグオーバー時のハイライトスタイル適用
    - _Requirements: 2.4_

- [x] 7. 既存コンポーネントの変更
  - [x] 7.1 `BookmarkCard` に読み物系トグルとピン留めアクションを追加
    - アクションメニューに「読み物系」トグルコントロールを追加
    - アクションメニューに「ピン留め/解除」アクションを追加
    - `isReadable === true` の場合のみ StatusSelector を表示
    - `pinned === true` の場合にピンアイコン/バッジを表示
    - _Requirements: 1.3, 1.4, 1.6, 6.6, 6.7_

  - [ ]* 7.2 StatusSelector 表示条件のプロパティテスト
    - **Property 2: StatusSelector visibility equals isReadable**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 7.3 `BookmarkCard` に最近アクセスハイライトを追加
    - `isRecentlyAccessed` ユーティリティを使用して 24 時間以内のアクセスを判定
    - 該当する場合に左ボーダーのハイライトスタイルを適用
    - `BookmarkCard.module.css` にハイライト用スタイルを追加
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.4 `BookmarkList` を `SortableBookmarkList` と統合
    - リスト表示モード時は `SortableBookmarkList` を使用
    - ピン留めブックマークを上部に表示するソート適用
    - _Requirements: 3.2, 3.5, 6.4_

  - [x] 7.5 `CollectionList` に `DroppableCollection` を統合
    - 各コレクション項目を `DroppableCollection` でラップ
    - ドラッグオーバー時のハイライトスタイル適用
    - _Requirements: 2.4_

- [x] 8. OGP プレビューポジショニングの実装
  - [-] 8.1 `OGPPreviewCard` にビューポート境界考慮のポジショニングを追加
    - `calculatePreviewPosition` 関数を実装: カードがビューポートからはみ出す場合は反対側に表示
    - ホバー 200ms 後にプレビュー表示、ポインター離脱で非表示
    - OGP 画像がない場合のプレースホルダー表示
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 9. ページ統合とワイヤリング
  - [x] 9.1 トップページに DndProvider を統合
    - `src/app/page.tsx` に `DndProvider` を追加
    - `useDragAndDrop` フックを接続
    - ドラッグ&ドロップのイベントフローを全コンポーネントに接続
    - 重複通知の表示ロジックを接続
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ]* 9.2 ドラッグ&ドロップ統合テスト
    - **Property 3: Drag-to-collection creates association**
    - **Property 4: Duplicate collection assignment is rejected**
    - **Property 5: Cancelled drag preserves state**
    - **Validates: Requirements 2.3, 2.5, 2.6**

- [x] 10. Final checkpoint - 全体検証
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- `@dnd-kit/core` と `@dnd-kit/sortable` パッケージのインストールが必要（タスク 6 開始前に実施）
- Amplify スキーマ変更後は `npx ampx sandbox` の再起動が必要

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.3", "2.5"] },
    { "id": 2, "tasks": ["1.4", "2.2", "2.4", "2.6"] },
    { "id": 3, "tasks": ["4.1", "4.3", "4.5"] },
    { "id": 4, "tasks": ["4.2", "4.4", "4.6", "4.7"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.4"] },
    { "id": 6, "tasks": ["6.3", "7.1", "7.3", "8.1"] },
    { "id": 7, "tasks": ["7.2", "7.4", "7.5"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
