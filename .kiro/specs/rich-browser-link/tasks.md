# Implementation Plan: Rich Browser Link

## Overview

Rich Browser Link の実装を、データモデル → ユーティリティ/バリデーション → カスタムフック → UI コンポーネント → エージェント → 統合の順で進める。各タスクは独立してテスト可能な単位に分割し、プロパティベーステスト（fast-check）でロジックの正確性を検証する。

## Tasks

- [x] 1. プロジェクト基盤セットアップ
  - [x] 1.1 テストフレームワーク（Vitest + fast-check）のセットアップ
    - `vitest`, `@testing-library/react`, `fast-check` をインストール
    - `vitest.config.ts` を作成し、パスエイリアス（`@/src`）を設定
    - `src/test/setup.ts` を作成（React Testing Library のグローバル設定）
    - _Requirements: Testing Strategy_

  - [x] 1.2 型定義とデータモデルインターフェースの作成
    - `src/types/index.ts` に Bookmark, Tag, Collection, BookmarkTag, BookmarkCollection の型を追加
    - `src/lib/import/types.ts` にインポート関連型（ParsedBookmark, ParseResult, ImportProgress, ImportResult 等）を作成
    - _Requirements: 1.1, 2.2, 3.1, 4.1, 5.1, 10.1_

  - [x] 1.3 Amplify Data スキーマの更新
    - `amplify/data/resource.ts` を設計書のスキーマに置き換え（Bookmark, Tag, BookmarkTag, Collection, BookmarkCollection）
    - `defaultAuthorizationMode` を `userPool` に変更
    - セカンダリインデックスを設定
    - _Requirements: 1.1, 8.2, 8.3, 8.4_

- [x] 2. バリデーションユーティリティの実装
  - [x] 2.1 URL バリデーション関数の実装
    - `src/lib/validators.ts` に `validateUrl` 関数を作成
    - http/https スキーム判定、2048 文字制限、RFC 3986 準拠チェック
    - _Requirements: 1.1, 1.7_

  - [ ]* 2.2 URL バリデーションのプロパティテスト
    - **Property 1: URL バリデーションの正確性**
    - **Validates: Requirements 1.1, 1.4, 1.7**

  - [x] 2.3 Tag 名バリデーション関数の実装
    - `src/lib/validators.ts` に `validateTagName` 関数を追加
    - 1-30 文字の範囲チェック
    - _Requirements: 4.5_

  - [ ]* 2.4 Tag 名バリデーションのプロパティテスト
    - **Property 5: Tag 名バリデーション**
    - **Validates: Requirements 4.5**

  - [x] 2.5 Collection 名・説明バリデーション関数の実装
    - `src/lib/validators.ts` に `validateCollectionName`, `validateCollectionDescription` 関数を追加
    - 名前: 1-100 文字、説明: 0-500 文字
    - _Requirements: 5.1, 5.6_

  - [ ]* 2.6 Collection バリデーションのプロパティテスト
    - **Property 10: Collection 名・説明バリデーション**
    - **Validates: Requirements 5.1, 5.6**

  - [x] 2.7 Bookmark 編集バリデーション関数の実装
    - `src/lib/validators.ts` に `validateBookmarkEdit` 関数を追加
    - タイトル: 1-200 文字、説明: 0-1000 文字、メモ: 0-2000 文字
    - _Requirements: 3.1, 3.2_

  - [ ]* 2.8 Bookmark 編集バリデーションのプロパティテスト
    - **Property 4: Bookmark 編集のラウンドトリップ**
    - **Validates: Requirements 3.1**

- [x] 3. Checkpoint - バリデーション基盤の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 検索・フィルタロジックの実装
  - [x] 4.1 全文検索ロジックの実装
    - `src/lib/search.ts` に `searchBookmarks` 関数を作成
    - タイトル・説明・URL・Tag を対象に部分一致検索
    - 一致フィールド数の降順ソート、最大 50 件制限
    - 検索キーワード 200 文字切り詰め
    - _Requirements: 6.1, 6.5_

  - [ ]* 4.2 全文検索のプロパティテスト
    - **Property 14: 全文検索の正確性**
    - **Property 15: 検索キーワードの切り詰め**
    - **Validates: Requirements 6.1, 6.5**

  - [x] 4.3 Tag オートコンプリートロジックの実装
    - `src/lib/tagUtils.ts` に `getTagSuggestions` 関数を作成
    - 前方一致フィルタ、最大 10 件制限
    - _Requirements: 4.2_

  - [ ]* 4.4 Tag オートコンプリートのプロパティテスト
    - **Property 6: Tag オートコンプリートの前方一致**
    - **Validates: Requirements 4.2**

  - [x] 4.5 複数 Tag AND フィルタロジックの実装
    - `src/lib/tagUtils.ts` に `filterBookmarksByTags` 関数を追加
    - 指定されたすべての Tag を持つ Bookmark のみを返す
    - _Requirements: 4.3_

  - [ ]* 4.6 複数 Tag AND フィルタのプロパティテスト
    - **Property 7: 複数 Tag による AND フィルタ**
    - **Validates: Requirements 4.3**

  - [x] 4.7 Tag ごとの Bookmark 数カウントロジックの実装
    - `src/lib/tagUtils.ts` に `countBookmarksPerTag` 関数を追加
    - _Requirements: 4.4_

  - [ ]* 4.8 Tag Bookmark 数のプロパティテスト
    - **Property 8: Tag ごとの Bookmark 数の正確性**
    - **Validates: Requirements 4.4**

  - [x] 4.9 Collection メンバーシップフィルタロジックの実装
    - `src/lib/collectionUtils.ts` に `filterBookmarksByCollection` 関数を作成
    - 特定 Collection のメンバーのみ返す、「未分類」フィルタ対応
    - _Requirements: 5.4, 5.5_

  - [ ]* 4.10 Collection メンバーシップフィルタのプロパティテスト
    - **Property 12: Collection メンバーシップフィルタの正確性**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 4.11 OGP フォールバック表示ロジックの実装
    - `src/lib/ogpUtils.ts` に `getDisplayTitle`, `shouldShowDescription` 関数を作成
    - OGP タイトル未設定時は URL を表示、説明未設定時は非表示
    - _Requirements: 7.5_

  - [ ]* 4.12 OGP フォールバックのプロパティテスト
    - **Property 16: OGP フォールバック表示**
    - **Validates: Requirements 7.5**

- [x] 5. Checkpoint - ロジック層の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Chrome ブックマークインポートロジックの実装
  - [x] 6.1 Netscape Bookmark File パーサーの実装
    - `src/lib/import/bookmarkParser.ts` に `parseNetscapeBookmarkFile` 関数を作成
    - DOMParser ベースの再帰的走査、フォルダパス追跡
    - DOCTYPE ヘッダー検証
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 6.2 URL フィルタリング関数の実装
    - `src/lib/import/bookmarkParser.ts` に `filterValidBookmarks` 関数を追加
    - http/https スキーム以外をスキップ
    - _Requirements: 10.13_

  - [ ]* 6.3 URL フィルタリングのプロパティテスト
    - **Property 23: 無効スキーム URL のフィルタリング**
    - **Validates: Requirements 10.13**

  - [x] 6.4 Collection 名生成関数の実装
    - `src/lib/import/bookmarkParser.ts` に `buildCollectionName` 関数を追加
    - フォルダパスを「/」で結合、100 文字切り詰め
    - _Requirements: 10.3_

  - [ ]* 6.5 Collection 名生成のプロパティテスト
    - **Property 19: フォルダ構造から Collection 名への変換の正確性**
    - **Validates: Requirements 10.3**

  - [ ]* 6.6 パーサーのラウンドトリッププロパティテスト
    - **Property 18: Netscape Bookmark File パーサーのラウンドトリップ**
    - **Validates: Requirements 10.14**

  - [x] 6.7 重複 URL 検出関数の実装
    - `src/lib/import/duplicateChecker.ts` に `checkDuplicateUrls` 関数を作成
    - 既存 Bookmark の URL と完全一致で重複検出
    - _Requirements: 10.7_

  - [ ]* 6.8 重複 URL 検出のプロパティテスト
    - **Property 20: 重複 URL 検出の正確性（インポート時）**
    - **Validates: Requirements 10.7**

  - [x] 6.9 バッチ分割関数の実装
    - `src/lib/import/batchProcessor.ts` に `splitIntoBatches` 関数を作成
    - 50 件ずつのバッチ分割、順序保持
    - _Requirements: 10.5_

  - [ ]* 6.10 バッチ分割のプロパティテスト
    - **Property 21: バッチ分割の完全性**
    - **Validates: Requirements 10.5**

  - [x] 6.11 バッチ処理エンジンの実装
    - `src/lib/import/batchProcessor.ts` に `processBatches` 関数を作成
    - Promise.allSettled による並列作成、失敗スキップ、進捗コールバック、AbortSignal 対応
    - _Requirements: 10.5, 10.6, 10.11_

  - [ ]* 6.12 インポート結果サマリーのプロパティテスト
    - **Property 22: インポート結果サマリーの整合性**
    - **Validates: Requirements 10.12**

- [x] 7. Checkpoint - インポートロジックの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. カスタムフックの実装
  - [x] 8.1 useBookmarks フックの実装
    - `src/hooks/useBookmarks.ts` を作成
    - Bookmark CRUD、ページネーション（20 件ずつ、nextToken）、重複チェック
    - _Requirements: 1.1, 1.5, 2.1, 2.3, 3.1, 3.3_

  - [ ]* 8.2 useBookmarks の重複検出プロパティテスト
    - **Property 2: 重複 URL 検出**
    - **Validates: Requirements 1.5**

  - [x] 8.3 useTags フックの実装
    - `src/hooks/useTags.ts` を作成
    - Tag CRUD、オートコンプリート、Bookmark への Tag 付与/解除
    - _Requirements: 4.1, 4.2, 4.6, 4.7_

  - [x] 8.4 useCollections フックの実装
    - `src/hooks/useCollections.ts` を作成
    - Collection CRUD、Bookmark の Collection 追加/削除、一意性チェック
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 5.8_

  - [ ]* 8.5 Collection 追加の冪等性プロパティテスト
    - **Property 11: Collection への Bookmark 追加の冪等性**
    - **Validates: Requirements 5.2**

  - [ ]* 8.6 Collection 名一意性のプロパティテスト
    - **Property 13: Collection 名の一意性制約**
    - **Validates: Requirements 5.8**

  - [x] 8.7 useSearch フックの実装
    - `src/hooks/useSearch.ts` を作成
    - 300ms デバウンス付き検索、リアルタイム結果更新
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.8 useImport フックの実装
    - `src/hooks/useImport.ts` を作成
    - ファイルパース、重複チェック、バッチインポート実行、キャンセル、進捗管理
    - _Requirements: 10.1, 10.5, 10.6, 10.7, 10.11, 10.12_

- [x] 9. Checkpoint - フック層の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. UI コンポーネントの実装（Bookmark 管理）
  - [x] 10.1 BookmarkCard コンポーネントの実装
    - `src/components/bookmark/BookmarkCard.tsx` を作成
    - タイトル、URL、OGP サムネイル、Tag バッジ表示
    - 編集・削除ボタン
    - _Requirements: 2.2, 7.1, 7.3_

  - [x] 10.2 OGPPreviewCard コンポーネントの実装
    - `src/components/bookmark/OGPPreviewCard.tsx` を作成
    - ホバー 200ms 後に表示、ホバーアウトで非表示
    - OGP タイトル、説明先頭 120 文字、画像表示
    - プレースホルダー画像対応
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 10.3 BookmarkList コンポーネントの実装
    - `src/components/bookmark/BookmarkList.tsx` を作成
    - 無限スクロール（IntersectionObserver）、ローディング状態、空状態メッセージ
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 10.4 BookmarkForm コンポーネントの実装
    - `src/components/bookmark/BookmarkForm.tsx` を作成
    - URL 入力、バリデーションエラー表示、Tag 入力統合
    - 作成/編集モード切替
    - _Requirements: 1.1, 1.7, 3.1, 3.2_

  - [x] 10.5 DuplicateDialog コンポーネントの実装
    - `src/components/bookmark/DuplicateDialog.tsx` を作成
    - 重複 URL 検出時の続行/中止選択
    - _Requirements: 1.5, 1.6_

  - [x] 10.6 BookmarkDeleteDialog コンポーネントの実装
    - `src/components/bookmark/BookmarkDeleteDialog.tsx` を作成
    - 削除確認ダイアログ、確認/キャンセル操作
    - _Requirements: 3.3, 3.4_

- [x] 11. UI コンポーネントの実装（Tag・Collection・検索）
  - [x] 11.1 TagInput コンポーネントの実装
    - `src/components/tag/TagInput.tsx` を作成
    - オートコンプリート付き Tag 入力、最大 20 個制限
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 11.2 TagFilter コンポーネントの実装
    - `src/components/tag/TagFilter.tsx` を作成
    - Tag 一覧表示（Bookmark 数付き）、複数選択による AND フィルタ
    - _Requirements: 4.3, 4.4_

  - [x] 11.3 TagBadge コンポーネントの実装
    - `src/components/tag/TagBadge.tsx` を作成
    - Tag 名表示、削除ボタン付きバッジ
    - _Requirements: 4.1_

  - [x] 11.4 CollectionList コンポーネントの実装
    - `src/components/collection/CollectionList.tsx` を作成
    - Collection 一覧サイドバー、選択状態、「未分類」表示
    - _Requirements: 5.4, 5.5_

  - [x] 11.5 CollectionForm コンポーネントの実装
    - `src/components/collection/CollectionForm.tsx` を作成
    - Collection 作成/編集フォーム、バリデーション
    - _Requirements: 5.1, 5.6, 5.8_

  - [x] 11.6 SearchBar コンポーネントの実装
    - `src/components/search/SearchBar.tsx` を作成
    - 検索入力、デバウンス 300ms、検索中インジケーター、0 件メッセージ
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 12. UI コンポーネントの実装（インポート機能）
  - [x] 12.1 ImportDialog コンポーネントの実装
    - `src/components/import/ImportDialog.tsx` を作成
    - ファイルドロップゾーン、10MB 制限、フォーマット検証エラー表示
    - プレビュー表示（ブックマーク数、フォルダ構造）
    - 重複処理選択（スキップ/マージ）
    - _Requirements: 10.1, 10.2, 10.7, 10.8, 10.9_

  - [x] 12.2 ImportProgress コンポーネントの実装
    - `src/components/import/ImportProgress.tsx` を作成
    - プログレスバー、処理済み/全件数、パーセンテージ、推定残り時間、キャンセルボタン
    - _Requirements: 10.5, 10.6_

  - [x] 12.3 ImportResultSummary コンポーネントの実装
    - `src/components/import/ImportResultSummary.tsx` を作成
    - 成功件数、スキップ件数、失敗件数、作成 Collection 数、失敗 URL 一覧
    - _Requirements: 10.11, 10.12_

- [x] 13. Checkpoint - UI コンポーネントの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. エージェント（Bookmark Agent）の実装
  - [x] 14.1 Bookmark Agent ディレクトリ構造の作成
    - `agents/bookmark_agent/__init__.py`, `agent.py`, `app.py`, `tools.py` を作成
    - `agents/requirements.txt` に必要な依存関係を追加（boto3, requests）
    - _Requirements: 9.6_

  - [x] 14.2 OGP Fetcher ツールの実装
    - `agents/bookmark_agent/tools.py` に `fetch_ogp` ツールを実装
    - URL から OGP メタデータ（タイトル、説明、画像 URL）を取得
    - 10 秒タイムアウト、エラー時は空データ返却
    - _Requirements: 1.2, 1.3_

  - [x] 14.3 Bookmark Search ツールの実装
    - `agents/bookmark_agent/tools.py` に `search_bookmarks` ツールを実装
    - DynamoDB SDK で owner のブックマークを検索
    - タイトル・URL・説明・Tag を対象にキーワード検索
    - _Requirements: 9.2, 9.3_

  - [ ]* 14.4 Bookmark Search ツールのプロパティテスト（pytest + hypothesis）
    - **Property 17: エージェント Bookmark 検索の関連性**
    - **Validates: Requirements 9.2**

  - [x] 14.5 Bookmark Agent 定義の実装
    - `agents/bookmark_agent/agent.py` に `create_agent` 関数を実装
    - システムプロンプト設定、ツール登録（fetch_ogp, search_bookmarks）
    - _Requirements: 9.2, 9.6_

  - [x] 14.6 AgentCore Runtime エントリーポイントの実装
    - `agents/bookmark_agent/app.py` に SSE ストリーミング対応エントリーポイントを実装
    - sample_agent/app.py のパターンを踏襲
    - _Requirements: 9.6, 9.7_

- [x] 15. Checkpoint - エージェント実装の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. トップページ統合と認証フロー
  - [x] 16.1 認証レイアウトの実装
    - `src/app/layout.tsx` を更新し、Amplify Authenticator でラップ
    - 未認証時はログイン画面表示
    - _Requirements: 8.1, 8.5_

  - [x] 16.2 トップページのレイアウト統合
    - `src/app/page.tsx` を書き換え、メインレイアウトを構築
    - BookmarkList, BookmarkForm, SearchBar, TagFilter, CollectionList, AgentChatSection を配置
    - サンプルページへのリンクを除外
    - _Requirements: 2.1, 9.1_

  - [x] 16.3 AgentChatSection の拡張
    - 既存の `src/components/agent/AgentChatSection.tsx` を Bookmark 検索用に拡張
    - 環境変数 `NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN` 未設定時のメッセージ表示
    - エラー時の会話履歴維持
    - _Requirements: 9.1, 9.7, 9.8, 9.9, 9.10_

  - [x] 16.4 OGP バックグラウンド取得の統合
    - `src/lib/ogpUtils.ts` に `fetchOGPInBackground` 関数を実装
    - エージェント経由での OGP 取得、同時実行数 3 制限、AbortSignal 対応
    - Bookmark 作成後およびインポート完了後に呼び出し
    - _Requirements: 1.2, 1.3, 10.10_

- [x] 17. 最終統合とスタイリング
  - [x] 17.1 ページスタイルの実装
    - `src/app/page.module.css` を更新
    - レスポンシブレイアウト（サイドバー + メインコンテンツ + チャット）
    - _Requirements: 2.1, 9.1_

  - [x] 17.2 全コンポーネントの結合確認
    - Bookmark 作成 → 一覧表示 → 検索 → Tag フィルタ → Collection フィルタの一連のフロー確認
    - インポートダイアログの全状態遷移確認
    - エージェントチャットの動作確認（未設定状態含む）
    - _Requirements: 1.1, 2.1, 4.3, 5.4, 6.1, 9.1, 10.1_

- [x] 18. Final checkpoint - 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- エージェント（Python）のプロパティテストは hypothesis ライブラリを使用
- フロントエンド（TypeScript）のプロパティテストは fast-check ライブラリを使用
- Amplify Data スキーマ変更後は `npx ampx sandbox` で動作確認が必要
- AgentCore Runtime へのデプロイは `agentcore launch` で別途実施

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.5", "2.7"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "2.8"] },
    { "id": 3, "tasks": ["4.1", "4.3", "4.5", "4.7", "4.9", "4.11"] },
    { "id": 4, "tasks": ["4.2", "4.4", "4.6", "4.8", "4.10", "4.12"] },
    { "id": 5, "tasks": ["6.1", "6.7", "6.9"] },
    { "id": 6, "tasks": ["6.2", "6.4", "6.11", "6.8", "6.10"] },
    { "id": 7, "tasks": ["6.3", "6.5", "6.6", "6.12"] },
    { "id": 8, "tasks": ["8.1", "8.3", "8.4", "8.7", "8.8"] },
    { "id": 9, "tasks": ["8.2", "8.5", "8.6"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 12, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 13, "tasks": ["14.1"] },
    { "id": 14, "tasks": ["14.2", "14.3"] },
    { "id": 15, "tasks": ["14.4", "14.5"] },
    { "id": 16, "tasks": ["14.6"] },
    { "id": 17, "tasks": ["16.1", "16.2", "16.3", "16.4"] },
    { "id": 18, "tasks": ["17.1", "17.2"] }
  ]
}
```
