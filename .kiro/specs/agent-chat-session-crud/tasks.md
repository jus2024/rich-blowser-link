# Implementation Plan: Agent Chat Session CRUD

## Overview

フロントエンドのセッション ID 永続化と新規会話リセット機能を追加し、エージェント側に CRUD ツール（create/update/delete/enrich）と AI 補完モジュールを実装する。既存の `tools.py` パターンに従い、新規ツールは `crud_tools.py` として分離し、AI 補完ロジックは `enrichment.py` に配置する。

## Tasks

- [x] 1. Frontend: セッション ID 永続化と新規会話リセット
  - [x] 1.1 useAgentChat フックに resetSession 関数を追加
    - `src/hooks/useAgentChat.ts` に `resetSession` 関数を追加
    - `resetSession` は新しい UUID v4 を `sessionIdRef` に設定し、`messages` を空配列にリセットする
    - `UseAgentChatReturn` インターフェースに `resetSession: () => void` を追加
    - 既存の `sessionIdRef` 初期化（`crypto.randomUUID()`）はそのまま維持
    - _Requirements: 1.4, 1.5_

  - [x] 1.2 AgentChatSection に「新しい会話」ボタンを追加
    - `src/components/agent/AgentChatSection.tsx` に新規会話ボタンを追加
    - ボタンクリック時に `resetSession()` を呼び出す
    - ボタンはヘッダー領域（h2 の横）に配置し、`isLoading` 中は無効化する
    - _Requirements: 1.4_

  - [ ]* 1.3 useAgentChat のセッション管理プロパティテストを作成
    - `src/hooks/__tests__/useAgentChat.property.test.ts` を作成
    - fast-check を使用
    - **Property 1: Session ID consistency** — 同一セッション内の全リクエストが同じ UUID v4 セッション ID を使用する
    - **Property 2: Session reset clears state** — resetSession 後にメッセージが空になり、新しい UUID v4 が生成される
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 2. Checkpoint - フロントエンド変更の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Agent: AI 補完モジュール（enrichment.py）の実装
  - [x] 3.1 enrichment.py を作成しプロンプトビルダーと Bedrock 呼び出しを実装
    - `agents/bookmark_agent/enrichment.py` を新規作成
    - `build_enrichment_prompt(url, ogp_title, ogp_description, existing_tags, existing_collections)` 関数を実装（既存 `promptBuilder.ts` のロジックを Python に移植）
    - `invoke_enrichment(prompt)` 関数を実装（`boto3` の `bedrock-runtime` クライアントで InvokeModel）
    - モデル ID は `common/config.py` の `get_model_id()` を使用
    - レスポンスは `{"suggestedTags": [...], "suggestedMemo": "...", "suggestedTitle": "...", "suggestedDescription": "...", "suggestedCollection": "..."}` 形式
    - タイムアウト: 30 秒
    - JSON パース失敗時は空の結果を返す
    - _Requirements: 3.3, 6.2_

  - [ ]* 3.2 enrichment.py のプロパティテストを作成
    - `agents/bookmark_agent/tests/test_enrichment_property.py` を作成
    - hypothesis を使用
    - **Property 6: Enrichment only fills empty fields** — 空フィールドのみに補完結果を適用し、非空フィールドは変更しない
    - Bedrock はモック（固定レスポンスまたはランダム有効レスポンス生成）を使用
    - **Validates: Requirements 3.4, 6.3**

- [x] 4. Agent: CRUD ツール（crud_tools.py）の実装
  - [x] 4.1 create_bookmark ツールを実装
    - `agents/bookmark_agent/crud_tools.py` を新規作成
    - `@tool` デコレータで `create_bookmark(url, owner_id)` を定義
    - URL 形式バリデーション（`urllib.parse.urlparse`）
    - UUID v4 で ID 生成、DynamoDB PutItem（owner, url, status="inbox", createdAt, updatedAt）
    - 成功時: ID、タイトル、URL を含むメッセージを返却
    - 不正 URL 時: エラーメッセージを返却
    - DynamoDB エラー時: エラーメッセージを返却、部分データなし
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 4.2 create_bookmark のプロパティテストを作成
    - `agents/bookmark_agent/tests/test_crud_tools_property.py` を作成
    - hypothesis + moto を使用
    - **Property 3: Bookmark creation invariants** — 有効な URL と owner_id で作成されたレコードが正しいフィールドを持つ
    - **Property 4: Invalid URL rejection** — 不正 URL で DynamoDB レコードが作成されない
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 4.3 update_bookmark ツールを実装
    - `agents/bookmark_agent/crud_tools.py` に `update_bookmark` を追加
    - `@tool` デコレータで `update_bookmark(bookmark_id, owner_id, memo, title, description, status, add_tags, remove_tags, add_collections, remove_collections)` を定義
    - GetItem + owner 検証 → 指定フィールドの UpdateItem
    - タグ追加: Tag テーブル検索 → 存在しなければ PutItem → BookmarkTag PutItem
    - タグ削除: BookmarkTag の該当レコードを DeleteItem
    - Collection 追加/削除: 同様のパターン
    - owner 不一致時: 「ブックマークが見つかりません」メッセージ
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.4 update_bookmark のプロパティテストを作成
    - `agents/bookmark_agent/tests/test_crud_tools_property.py` に追加
    - **Property 5: Owner isolation** — owner 不一致時に「ブックマークが見つかりません」を返す
    - **Property 7: Tag upsert and association** — タグが検索/作成され BookmarkTag 関連が存在する
    - **Property 8: Collection upsert and association** — Collection が検索/作成され BookmarkCollection 関連が存在する
    - **Property 9: Tag removal** — タグ削除で BookmarkTag レコードが削除される
    - **Property 10: Collection removal** — Collection 削除で BookmarkCollection レコードが削除される
    - **Property 12: Field update preserves unspecified fields** — 指定フィールドのみ更新、他は不変
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

  - [x] 4.5 delete_bookmark ツールを実装
    - `agents/bookmark_agent/crud_tools.py` に `delete_bookmark` を追加
    - `@tool` デコレータで `delete_bookmark(bookmark_id, owner_id)` を定義
    - GetItem + owner 検証
    - BookmarkTag テーブルから関連レコードを Scan → 各レコードを DeleteItem
    - BookmarkCollection テーブルから関連レコードを Scan → 各レコードを DeleteItem
    - Bookmark レコードを DeleteItem
    - 成功時: 削除されたブックマークのタイトルと URL を含むメッセージ
    - owner 不一致/存在しない場合: 「ブックマークが見つかりません」メッセージ
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 4.6 delete_bookmark のプロパティテストを作成
    - `agents/bookmark_agent/tests/test_crud_tools_property.py` に追加
    - **Property 11: Cascade delete** — 関連する BookmarkTag、BookmarkCollection、Bookmark レコードが全て削除される
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

  - [x] 4.7 enrich_bookmark ツールを実装
    - `agents/bookmark_agent/crud_tools.py` に `enrich_bookmark` を追加
    - `@tool` デコレータで `enrich_bookmark(bookmark_id, owner_id)` を定義
    - GetItem + owner 検証
    - 既存タグ・コレクション一覧を取得（プロンプトコンテキスト用）
    - `enrichment.py` の `build_enrichment_prompt` + `invoke_enrichment` を呼び出し
    - 空フィールドのみに結果を適用（UpdateItem）
    - suggestedTags → Tag 検索/作成 + BookmarkTag 関連付け
    - suggestedCollection → Collection 検索/作成 + BookmarkCollection 関連付け
    - 成功時: 適用された補完内容のサマリーを返却
    - AI 補完失敗時: エラーメッセージ、既存データ変更なし
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 4.8 enrich_bookmark のプロパティテストを作成
    - `agents/bookmark_agent/tests/test_crud_tools_property.py` に追加
    - **Property 13: OGP metadata application** — OGP 取得結果の非空フィールドが Bookmark に反映される
    - Bedrock はモック使用
    - **Validates: Requirements 3.2**

- [x] 5. Checkpoint - CRUD ツールとエンリッチメントの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Agent: agent.py の更新（ツール登録 + システムプロンプト更新）
  - [x] 6.1 agent.py に CRUD ツールを登録しシステムプロンプトを更新
    - `agents/bookmark_agent/agent.py` の `create_agent` 関数を更新
    - `crud_tools.py` から `create_bookmark`, `update_bookmark`, `delete_bookmark`, `enrich_bookmark` をインポート
    - `Agent` の `tools` リストに 4 つのツールを追加
    - `SYSTEM_PROMPT` に CRUD ツールの使い分けガイドを追加（create_bookmark, update_bookmark, delete_bookmark, enrich_bookmark の説明）
    - ブックマーク作成後の OGP 取得 → AI 補完フローをシステムプロンプトに指示として記載
    - _Requirements: 2.1, 3.1, 3.6, 3.7, 4.1, 5.1, 6.1_

- [x] 7. Integration: 全コンポーネントの結合確認
  - [x] 7.1 フロントエンドとエージェントの結合確認
    - `agents/bookmark_agent/agent.py` のインポートが正常に解決されることを確認
    - `src/hooks/useAgentChat.ts` の型チェックが通ることを確認
    - `src/components/agent/AgentChatSection.tsx` の型チェックが通ることを確認
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 7.2 ユニットテストを作成
    - Python: DynamoDB 書き込み失敗時のエラーハンドリング、OGP 取得失敗時の Graceful Degradation、AI 補完失敗時のデータ保全
    - TypeScript: resetSession の動作、session ID の UUID v4 形式検証
    - _Requirements: 2.6, 3.6, 3.7, 6.8_

- [x] 8. Final checkpoint - 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- Python テストは `hypothesis` + `moto` を使用（DynamoDB モック）
- TypeScript テストは `fast-check` を使用（セッション管理のプロパティテスト）
- フロントエンド変更は最小限（セッション ID 永続化 + 新規会話ボタン）
- エージェント側は既存の `tools.py` パターンに従い `crud_tools.py` として分離
- AI 補完は `enrichment.py` に分離し、既存 `promptBuilder.ts` のロジックを Python に移植

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5"] },
    { "id": 4, "tasks": ["4.6", "4.7"] },
    { "id": 5, "tasks": ["4.8", "6.1"] },
    { "id": 6, "tasks": ["7.1", "7.2"] }
  ]
}
```
