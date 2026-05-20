# Implementation Plan: UX Enhancement

## Overview

Rich Browser Link アプリケーションの UX を 3 領域で強化する実装計画。(1) Collection 操作 UI の完全実装、(2) 表示モード切替とファビコン自動取得、(3) Read Later ステータス管理・アクセス追跡・ソート機能。既存の Next.js 15 + Amplify Gen 2 アーキテクチャを段階的に拡張し、各ステップで動作確認可能な状態を維持する。

## Tasks

- [x] 1. データモデル変更と型定義の拡張
  - [x] 1.1 Amplify Data スキーマに新規フィールドを追加する
    - `amplify/data/resource.ts` の Bookmark モデルに `status`（string, default "inbox"）、`accessCount`（integer, default 0）、`lastAccessedAt`（string, default ""）フィールドを追加する
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 1.2 型定義ファイルを拡張する
    - `src/types/index.ts` に `BookmarkStatus`, `DisplayMode`, `SortKey` 型を追加する
    - `Bookmark` インターフェースに `status`, `accessCount`, `lastAccessedAt` フィールドを追加する
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 1.3 useBookmarks フックの mapRecordToBookmark を更新する
    - `src/hooks/useBookmarks.ts` のマッピング関数で新フィールドのフォールバック処理を追加する（status → "inbox", accessCount → 0, lastAccessedAt → ""）
    - _Requirements: 14.4, 14.5_

  - [ ]* 1.4 Write property test for backward-compatible mapping
    - **Property 24: 後方互換マッピング**
    - **Validates: Requirements 14.4, 14.5**

- [x] 2. ユーティリティ関数の実装
  - [x] 2.1 ファビコン URL 生成ユーティリティを作成する
    - `src/lib/faviconUtils.ts` を作成し、`getFaviconUrl(url: string): string` 関数を実装する
    - URL からドメインを抽出し、`https://www.google.com/s2/favicons?domain={domain}&sz=32` 形式の URL を返す
    - 不正な URL の場合は空文字列を返す
    - _Requirements: 9.1, 9.4_

  - [ ]* 2.2 Write property test for favicon URL generation
    - **Property 13: ファビコン URL 生成の正確性**
    - **Validates: Requirements 9.1**

  - [x] 2.3 ソートユーティリティを作成する
    - `src/lib/sortUtils.ts` を作成し、`sortByCreatedAt`, `sortByLastAccessedAt`, `sortByAccessCount` 関数を実装する
    - `sortByLastAccessedAt` は未アクセス（空文字列）の Bookmark を末尾に配置する
    - _Requirements: 13.2, 13.3, 13.4_

  - [ ]* 2.4 Write property tests for sort utilities
    - **Property 21: createdAt 降順ソート**
    - **Property 22: lastAccessedAt 降順ソート（未アクセス末尾配置）**
    - **Property 23: accessCount 降順ソート**
    - **Validates: Requirements 13.2, 13.3, 13.4**

  - [x] 2.5 Collection バリデーション関数を確認・拡張する
    - `src/lib/validators.ts` の `validateCollectionName` と `validateCollectionDescription` が設計仕様（名前 1-100 文字、説明 0-500 文字）を満たしていることを確認する
    - _Requirements: 1.2, 1.4, 2.2_

  - [ ]* 2.6 Write property tests for Collection validation
    - **Property 1: Collection 名バリデーション**
    - **Property 3: Collection 編集バリデーション**
    - **Validates: Requirements 1.2, 1.4, 2.2**

- [x] 3. Checkpoint - データモデルとユーティリティの検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. カスタムフックの実装
  - [x] 4.1 useDisplayMode フックを作成する
    - `src/hooks/useDisplayMode.ts` を作成し、表示モード（list / grid / compact）の状態管理と localStorage 永続化を実装する
    - localStorage 読み込み失敗時は "list" にフォールバックする
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 4.2 Write property test for display mode localStorage round-trip
    - **Property 12: 表示モード localStorage ラウンドトリップ**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 4.3 useSort フックを作成する
    - `src/hooks/useSort.ts` を作成し、ソートキー（createdAt / lastAccessedAt / accessCount）の状態管理と `sortBookmarks` 関数を実装する
    - デフォルトは "createdAt"
    - _Requirements: 13.1, 13.5_

  - [x] 4.4 useAccessTracker フックを作成する
    - `src/hooks/useAccessTracker.ts` を作成し、`trackAccess(bookmarkId)` 関数を実装する
    - Bookmark の `accessCount` を 1 インクリメントし、`lastAccessedAt` を現在の ISO 8601 日時で更新する
    - API エラー時はコンソールログのみ（リンク遷移を妨げない）
    - _Requirements: 12.1, 12.2, 12.4_

  - [ ]* 4.5 Write property tests for access tracking logic
    - **Property 19: アクセス回数インクリメント**
    - **Property 20: 最終アクセス日時の更新**
    - **Validates: Requirements 12.1, 12.2**

  - [x] 4.6 useBookmarks フックにステータス更新メソッドを追加する
    - `src/hooks/useBookmarks.ts` に `updateBookmarkStatus(id, status)` メソッドを追加する
    - 楽観的 UI 更新を行い、API 失敗時にロールバックする
    - _Requirements: 10.3_

  - [ ]* 4.7 Write property test for status update persistence
    - **Property 15: ステータス更新の永続化**
    - **Validates: Requirements 10.3**

  - [ ]* 4.8 Write property test for new bookmark default values
    - **Property 14: 新規 Bookmark のデフォルト値**
    - **Validates: Requirements 10.1, 10.4, 12.3**

- [x] 5. Checkpoint - フック層の検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 共通 UI コンポーネントの実装
  - [x] 6.1 Favicon コンポーネントを作成する
    - `src/components/common/Favicon.tsx` と `Favicon.module.css` を作成する
    - `getFaviconUrl` を使用して画像を表示し、`onError` でデフォルトグローブアイコン SVG にフォールバックする
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 6.2 DisplayModeSwitcher コンポーネントを作成する
    - `src/components/common/DisplayModeSwitcher.tsx` と `DisplayModeSwitcher.module.css` を作成する
    - リスト・グリッド・コンパクトの 3 つの切替ボタンを表示し、選択状態をハイライトする
    - _Requirements: 5.1_

  - [x] 6.3 SortSelector コンポーネントを作成する
    - `src/components/common/SortSelector.tsx` と `SortSelector.module.css` を作成する
    - 作成日時・最終アクセス日時・アクセス回数の 3 つのソート条件を選択可能にする
    - _Requirements: 13.1_

  - [x] 6.4 BookmarkToolbar コンポーネントを作成する
    - `src/components/bookmark/BookmarkToolbar.tsx` と `BookmarkToolbar.module.css` を作成する
    - DisplayModeSwitcher と SortSelector を含むツールバーとして構成する
    - _Requirements: 5.1, 13.1_

- [x] 7. ステータス関連 UI コンポーネントの実装
  - [x] 7.1 StatusBadge コンポーネントを作成する
    - `src/components/bookmark/StatusBadge.tsx` と `StatusBadge.module.css` を作成する
    - Bookmark のステータス（inbox / read / archived）に応じたバッジを表示する
    - _Requirements: 10.5_

  - [ ]* 7.2 Write property test for status badge accuracy
    - **Property 16: ステータスバッジの正確性**
    - **Validates: Requirements 10.5**

  - [x] 7.3 StatusSelector コンポーネントを作成する
    - `src/components/bookmark/StatusSelector.tsx` を作成する
    - inbox・read・archived の選択肢を表示し、選択時に `onStatusChange` を呼び出す
    - _Requirements: 10.2_

  - [x] 7.4 StatusFilter コンポーネントを作成する
    - `src/components/filter/StatusFilter.tsx` と `StatusFilter.module.css` を作成する
    - サイドバーにステータスフィルターセクションを表示し、各ステータスの件数を表示する
    - _Requirements: 11.1, 11.4_

  - [ ]* 7.5 Write property test for status count accuracy
    - **Property 18: ステータス別 Bookmark 件数の正確性**
    - **Validates: Requirements 11.4**

- [x] 8. Collection 操作 UI コンポーネントの実装
  - [x] 8.1 CollectionList を拡張する（編集・削除アクション追加）
    - `src/components/collection/CollectionList.tsx` に各 Collection 項目のコンテキストメニュー（編集・削除）を追加する
    - _Requirements: 2.1, 3.1_

  - [x] 8.2 CollectionDeleteDialog コンポーネントを作成する
    - `src/components/collection/CollectionDeleteDialog.tsx` と `CollectionDeleteDialog.module.css` を作成する
    - 削除確認ダイアログを表示し、確認/キャンセル操作を提供する
    - _Requirements: 3.1, 3.3_

  - [x] 8.3 CollectionAssignDropdown コンポーネントを作成する
    - `src/components/collection/CollectionAssignDropdown.tsx` と `CollectionAssignDropdown.module.css` を作成する
    - 全 Collection のチェックボックス付きドロップダウンを表示し、割り当て済み Collection にチェックを入れる
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 8.4 Write property tests for Collection assignment logic
    - **Property 5: Bookmark-Collection 割り当ての冪等性**
    - **Property 6: Bookmark の複数 Collection 同時所属**
    - **Property 7: Collection 割り当てドロップダウンの正確性**
    - **Validates: Requirements 4.4, 4.5, 4.1**

  - [ ]* 8.5 Write property test for Collection name uniqueness
    - **Property 2: Collection 名の一意性制約**
    - **Validates: Requirements 1.5, 2.3**

  - [ ]* 8.6 Write property test for Collection deletion preserving Bookmarks
    - **Property 4: Collection 削除時の Bookmark 保持**
    - **Validates: Requirements 3.2**

- [x] 9. Checkpoint - UI コンポーネントの検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. 表示モード別コンポーネントの実装
  - [x] 10.1 BookmarkCard を拡張する（リスト表示用）
    - `src/components/bookmark/BookmarkCard.tsx` に `onLinkClick`, `onStatusChange`, `onAssignCollection` props を追加する
    - Favicon コンポーネント、StatusBadge、StatusSelector、CollectionAssignDropdown を統合する
    - _Requirements: 5.2, 9.2, 10.5, 12.1_

  - [ ]* 10.2 Write property test for list view information completeness
    - **Property 8: リスト表示の情報完全性**
    - **Validates: Requirements 5.2**

  - [x] 10.3 BookmarkGrid コンポーネントを作成する
    - `src/components/bookmark/BookmarkGrid.tsx` と `BookmarkGrid.module.css` を作成する
    - OGP 画像を大きく表示したカード形式で複数列グリッドレイアウトを実装する
    - OGP 画像がない場合はファビコン拡大プレースホルダーを表示する
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 10.4 Write property tests for grid view
    - **Property 9: グリッド表示の情報完全性**
    - **Property 10: グリッド表示の OGP フォールバック**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 10.5 BookmarkCompactList コンポーネントを作成する
    - `src/components/bookmark/BookmarkCompactList.tsx` と `BookmarkCompactList.module.css` を作成する
    - ファビコン、タイトル、URL のみの 1 行形式で表示し、ホバー時のみ編集・削除アクションを表示する
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 10.6 Write property test for compact view minimal information
    - **Property 11: コンパクト表示の最小情報表示**
    - **Validates: Requirements 7.1, 7.2**

- [x] 11. ページ統合（page.tsx の更新）
  - [x] 11.1 page.tsx にフック統合とステータスフィルタリングを追加する
    - `useDisplayMode`, `useSort`, `useAccessTracker` フックを統合する
    - ステータスフィルター状態を追加し、Collection フィルターとの AND 合成を実装する
    - _Requirements: 8.2, 11.2, 11.3, 13.5_

  - [ ]* 11.2 Write property test for filter AND composition
    - **Property 17: ステータスフィルターと Collection フィルターの AND 合成**
    - **Validates: Requirements 11.2, 11.3**

  - [x] 11.3 page.tsx にツールバーと表示モード切替を統合する
    - BookmarkToolbar を SearchBar の下に配置する
    - displayMode に応じて BookmarkList / BookmarkGrid / BookmarkCompactList を切り替えて表示する
    - _Requirements: 5.1, 5.3, 6.1, 7.1_

  - [x] 11.4 page.tsx にサイドバー拡張を統合する
    - StatusFilter をサイドバーに追加する
    - CollectionList に編集・削除アクションのハンドラーを接続する
    - CollectionForm のインライン表示（作成・編集）を実装する
    - CollectionDeleteDialog を接続する
    - _Requirements: 1.1, 1.3, 1.6, 2.1, 2.4, 3.1, 3.4, 11.1_

  - [x] 11.5 page.tsx にアクセス追跡とリンククリックハンドラーを統合する
    - Bookmark カードのリンククリック時に `trackAccess` を呼び出し、新しいタブでリンク先を開く
    - ステータス変更ハンドラーを接続する
    - _Requirements: 12.1, 12.2, 12.4, 10.3_

  - [x] 11.6 BookmarkList コンポーネントの props を拡張する
    - `src/components/bookmark/BookmarkList.tsx` に `onLinkClick`, `onStatusChange`, `onAssignCollection` props を追加する
    - _Requirements: 5.2, 10.5, 12.1_

- [x] 12. Final checkpoint - 全体統合の検証
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (24 properties total)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations use TypeScript
- Amplify Data スキーマ変更後は `npx ampx sandbox` の再起動が必要
- 既存の Bookmark データは新フィールドのフォールバック処理により後方互換性を維持する
- ファビコンは Google Favicon API を使用しクライアントサイドで動的生成（DB 保存不要）
- ソートはクライアントサイドで実行（個人利用の数百件規模を想定）

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.3", "2.5"] },
    { "id": 2, "tasks": ["1.4", "2.2", "2.4", "2.6"] },
    { "id": 3, "tasks": ["4.1", "4.3", "4.4", "4.6"] },
    { "id": 4, "tasks": ["4.2", "4.5", "4.7", "4.8"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "7.1", "7.3", "7.4"] },
    { "id": 6, "tasks": ["6.4", "7.2", "7.5", "8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["8.4", "8.5", "8.6"] },
    { "id": 8, "tasks": ["10.1", "10.3", "10.5"] },
    { "id": 9, "tasks": ["10.2", "10.4", "10.6", "11.6"] },
    { "id": 10, "tasks": ["11.1", "11.3", "11.4", "11.5"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
