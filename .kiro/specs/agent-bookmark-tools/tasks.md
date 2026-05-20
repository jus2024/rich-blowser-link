# Implementation Plan: Agent Bookmark Tools

## Overview

Bookmark Agent の DynamoDB アクセスツール群を拡張する。`common/config.py` にテーブル名取得ヘルパーを追加し、`bookmark_agent/tools.py` に 4 つの新規ツール関数（list_bookmarks, get_bookmark_detail, list_tags, list_collections）を追加、既存の search_bookmarks を改善する。テストは pytest + Hypothesis + moto で実施する。

## Tasks

- [x] 1. テーブル設定ヘルパーとテスト基盤のセットアップ
  - [x] 1.1 `common/config.py` に `get_table_names()` 関数を追加
    - 5 つの環境変数（BOOKMARK_TABLE_NAME, TAG_TABLE_NAME, BOOKMARKTAG_TABLE_NAME, COLLECTION_TABLE_NAME, BOOKMARKCOLLECTION_TABLE_NAME）からテーブル名を取得
    - 未設定の変数がある場合は `ConfigurationError` を raise（変数名を含むメッセージ）
    - `ConfigurationError` カスタム例外クラスを `common/config.py` に定義
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.2 テスト基盤をセットアップ（`agents/tests/conftest.py`）
    - moto で DynamoDB テーブル（Bookmark, Tag, BookmarkTag, Collection, BookmarkCollection）を作成する pytest fixture
    - テスト用のサンプルデータ生成ヘルパー
    - Hypothesis 用のカスタム strategy（owner_id, bookmark データ等）
    - `pyproject.toml` の dev 依存に hypothesis, moto を追加
    - _Requirements: 5.1, 5.2_

  - [ ]* 1.3 `get_table_names()` のプロパティテストを作成
    - **Property 9: Missing environment variable detection**
    - **Validates: Requirements 5.2**

- [x] 2. Checkpoint - テスト基盤の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. search_bookmarks の改善
  - [x] 3.1 `search_bookmarks` を改善（`bookmark_agent/tools.py`）
    - memo フィールドを検索対象に追加
    - owner フィルタを `contains` から完全一致（`=`）に修正
    - 空の owner_id チェックを追加（エラーメッセージ返却）
    - 戻り値を構造化文字列（dict with total_count + bookmarks リスト）に変更
    - 複数キーワードのマッチ数でランキングソート
    - try/except で ClientError, タイムアウト, 汎用エラーをハンドリング
    - `get_table_names()` からテーブル名を取得するように変更
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.2 search_bookmarks のプロパティテスト（`agents/tests/test_tools_props.py`）
    - **Property 1: Owner-based data isolation**
    - **Validates: Requirements 1.2, 4.1, 4.4**

  - [ ]* 3.3 search_bookmarks のプロパティテスト
    - **Property 2: Search keyword matching across fields**
    - **Validates: Requirements 1.1**

  - [ ]* 3.4 search_bookmarks のプロパティテスト
    - **Property 3: Search ranking by relevance**
    - **Validates: Requirements 1.4**

- [x] 4. list_bookmarks の実装
  - [x] 4.1 `list_bookmarks` ツール関数を実装（`bookmark_agent/tools.py`）
    - パラメータ: owner_id, status, tag_name, collection_name, limit
    - owner_id 必須チェック
    - Bookmark テーブルを Scan し owner フィルタ（完全一致）
    - status フィルタ: DynamoDB FilterExpression に追加
    - tag_name フィルタ: Tag テーブルから tag_id 取得 → BookmarkTag テーブルから bookmark_id リスト取得 → フィルタ
    - collection_name フィルタ: Collection テーブルから collection_id 取得 → BookmarkCollection テーブルから bookmark_id リスト取得 → フィルタ
    - limit による件数制限と more_exists フラグ
    - 構造化文字列レスポンス（total_count, returned_count, more_exists, bookmarks）
    - エラーハンドリング（ClientError, タイムアウト）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.2 list_bookmarks のプロパティテスト
    - **Property 4: Status filter correctness**
    - **Validates: Requirements 2.2**

  - [ ]* 4.3 list_bookmarks のプロパティテスト
    - **Property 5: Tag and collection filter correctness**
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 4.4 list_bookmarks のプロパティテスト
    - **Property 6: Limit and pagination behavior**
    - **Validates: Requirements 2.5**

- [x] 5. get_bookmark_detail の実装
  - [x] 5.1 `get_bookmark_detail` ツール関数を実装（`bookmark_agent/tools.py`）
    - パラメータ: bookmark_id, owner_id
    - owner_id 必須チェック
    - Bookmark テーブルから GetItem で取得
    - owner フィールドの完全一致チェック（不一致時は「見つかりません」メッセージ）
    - BookmarkTag テーブルから関連 tag_id を取得 → Tag テーブルからタグ名を取得
    - BookmarkCollection テーブルから関連 collection_id を取得 → Collection テーブルからコレクション名を取得
    - 構造化文字列レスポンス（bookmark 全フィールド + tags + collections）
    - 存在しない bookmark_id の場合は「見つかりません」メッセージ
    - エラーハンドリング
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2_

  - [ ]* 5.2 get_bookmark_detail のプロパティテスト
    - **Property 7: Detail retrieval completeness (round-trip)**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 6. list_tags と list_collections の実装
  - [x] 6.1 `list_tags` ツール関数を実装（`bookmark_agent/tools.py`）
    - パラメータ: owner_id
    - owner_id 必須チェック
    - Tag テーブルを Scan し owner フィルタ（完全一致）
    - 構造化文字列レスポンス（total_count + tags リスト with id, name）
    - エラーハンドリング
    - _Requirements: 7.1, 7.3, 7.5, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2_

  - [x] 6.2 `list_collections` ツール関数を実装（`bookmark_agent/tools.py`）
    - パラメータ: owner_id
    - owner_id 必須チェック
    - Collection テーブルを Scan し owner フィルタ（完全一致）
    - 構造化文字列レスポンス（total_count + collections リスト with id, name, description）
    - エラーハンドリング
    - _Requirements: 7.2, 7.4, 7.5, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2_

  - [ ]* 6.3 list_tags / list_collections のプロパティテスト
    - **Property 12: Response contains required fields**
    - **Validates: Requirements 6.3, 7.3, 7.4**

- [x] 7. Checkpoint - 全ツール関数の動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. エージェント登録とシステムプロンプト更新
  - [x] 8.1 `bookmark_agent/agent.py` を更新
    - 新ツール（list_bookmarks, get_bookmark_detail, list_tags, list_collections）を import に追加
    - Agent の tools リストに新ツールを登録
    - システムプロンプトを更新し、各ツールの使い分けガイダンスを追加（検索 vs 一覧 vs 詳細 vs タグ/コレクション一覧）
    - _Requirements: 1.1, 2.1, 3.1, 7.1, 7.2_

- [ ] 9. 横断的プロパティテストとユニットテスト
  - [ ]* 9.1 owner_id 空文字拒否のプロパティテスト
    - **Property 8: Empty owner_id rejection**
    - **Validates: Requirements 4.3**

  - [ ]* 9.2 エラーハンドリングのプロパティテスト
    - **Property 10: Error handling returns user-friendly message**
    - **Validates: Requirements 6.1**

  - [ ]* 9.3 total_count 正確性のプロパティテスト
    - **Property 11: Total count accuracy**
    - **Validates: Requirements 6.4**

  - [ ]* 9.4 ユニットテストを作成（`agents/tests/test_tools_unit.py`）
    - 検索結果 0 件のレスポンス形式テスト
    - DynamoDB タイムアウト時のエラーメッセージテスト
    - 存在しない bookmark_id での get_bookmark_detail テスト
    - 各環境変数が個別に未設定の場合のエラーメッセージテスト
    - get_aws_region() の値が DynamoDB クライアントに渡されることの確認
    - _Requirements: 1.3, 1.5, 3.4, 5.2, 6.1, 6.2_

- [x] 10. Final checkpoint - 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- テスト実行: `cd agents && pytest tests/ -v`
- moto を使用するため AWS 認証情報不要でローカルテスト可能

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "4.1", "6.1", "6.2"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.1", "6.3"] },
    { "id": 4, "tasks": ["5.2", "8.1"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3", "9.4"] }
  ]
}
```
