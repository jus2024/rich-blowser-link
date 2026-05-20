# Requirements Document

## Introduction

AgentCore Runtime 上で動作する Bookmark Agent のチャット体験を改善する機能。現状、毎回のリクエストが独立しており会話の文脈が引き継がれない問題と、エージェントがブックマークの作成・更新・削除操作を実行できない問題を解決する。

具体的には以下を実現する:
1. AgentCore Runtime のセッション管理機能を活用し、同一セッション内で会話履歴を引き継ぐ
2. エージェントにブックマーク CRUD ツールを追加し、自然言語でのデータ操作を可能にする
3. ブックマーク作成時に OGP 取得と AI 補完を自動トリガーし、メタデータを自動付与する

## Glossary

- **Agent_Chat**: フロントエンドの AgentCore Runtime チャット UI コンポーネントおよび通信フック（useAgentChat）
- **AgentCore_Runtime**: Amazon Bedrock AgentCore Runtime。エージェントの実行基盤であり、HTTP POST + SSE でフロントエンドと通信する
- **Session_Id**: `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` ヘッダーで送信される UUID v4 形式のセッション識別子
- **Bookmark_Agent**: Strands Agents SDK で構築された Python エージェント。AgentCore Runtime 上で実行される
- **Bookmark**: ユーザーが保存したリンクと OGP メタデータを持つデータモデル（DynamoDB）
- **Tag**: Bookmark に付与するラベル。BookmarkTag 中間テーブルで多対多関連
- **Collection**: Bookmark をまとめるフォルダ。BookmarkCollection 中間テーブルで多対多関連
- **Owner_Id**: Cognito ユーザー ID（sub クレーム）。`sub::sub` 形式で DynamoDB の owner フィールドに格納される
- **AI_Enrichment**: Amazon Bedrock を利用してタグ候補・メモ・タイトル・説明・Collection を自動提案する機能
- **OGP_Metadata**: Open Graph Protocol に基づく URL のメタデータ（タイトル、説明、画像 URL）
- **Create_Bookmark_Tool**: エージェントが URL を指定してブックマークを新規作成するツール関数
- **Update_Bookmark_Tool**: エージェントがブックマークのフィールドを更新するツール関数
- **Delete_Bookmark_Tool**: エージェントがブックマークを削除するツール関数
- **Enrich_Bookmark_Tool**: エージェントが AI 補完をトリガーするツール関数

## Requirements

### Requirement 1: セッション内会話履歴の引き継ぎ

**User Story:** As a ユーザー, I want エージェントとの会話が同一セッション内で文脈を引き継ぐ, so that 会話のキャッチボールができ、前の質問を踏まえた回答を得られる。

#### Acceptance Criteria

1. WHEN ユーザーが同一チャットセッション内でメッセージを送信する, THE Agent_Chat SHALL 同一の Session_Id を `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` ヘッダーに付与してリクエストを送信する
2. WHILE 同一セッションが継続している, THE AgentCore_Runtime SHALL 過去の会話履歴を保持し、Bookmark_Agent に文脈として提供する
3. WHEN ユーザーがページをリロードする, THE Agent_Chat SHALL 新しい Session_Id を生成し、新規セッションとして開始する
4. WHEN ユーザーが「新しい会話」ボタンを押す, THE Agent_Chat SHALL 新しい Session_Id を生成し、メッセージ履歴をクリアする
5. THE Agent_Chat SHALL Session_Id を UUID v4 形式で生成する

### Requirement 2: エージェントからのブックマーク作成

**User Story:** As a ユーザー, I want エージェントに URL を伝えてブックマークを登録してもらう, so that チャットから離れずにブックマークを保存できる。

#### Acceptance Criteria

1. WHEN ユーザーが URL を指定してブックマーク作成を依頼する, THE Create_Bookmark_Tool SHALL 指定された URL で新しい Bookmark レコードを DynamoDB に作成する
2. WHEN Bookmark レコードを作成する, THE Create_Bookmark_Tool SHALL Owner_Id を owner フィールドに設定する
3. WHEN Bookmark レコードを作成する, THE Create_Bookmark_Tool SHALL status フィールドを "inbox" に設定する
4. WHEN Bookmark の作成が成功する, THE Create_Bookmark_Tool SHALL 作成された Bookmark の ID、タイトル、URL を含む成功メッセージを返す
5. IF 指定された URL が不正な形式である, THEN THE Create_Bookmark_Tool SHALL URL 形式エラーメッセージを返す
6. IF DynamoDB への書き込みが失敗する, THEN THE Create_Bookmark_Tool SHALL エラーメッセージを返し、部分的なデータを残さない

### Requirement 3: ブックマーク作成時の OGP 取得と AI 補完

**User Story:** As a ユーザー, I want エージェント経由でブックマークを作成した際に OGP 情報と AI 補完が自動適用される, so that 手動でメタデータを入力する手間が省ける。

#### Acceptance Criteria

1. WHEN Create_Bookmark_Tool が Bookmark を作成した後, THE Bookmark_Agent SHALL fetch_ogp ツールを使用して OGP_Metadata を取得する
2. WHEN OGP_Metadata の取得が成功する, THE Bookmark_Agent SHALL Bookmark の title、description、ogpImageUrl フィールドを OGP 値で更新する
3. WHEN OGP_Metadata の取得が完了する, THE Enrich_Bookmark_Tool SHALL AI_Enrichment を実行してタグ候補、メモ、タイトル補完、説明補完、suggestedCollection を取得する
4. WHEN AI_Enrichment の結果を受け取る, THE Enrich_Bookmark_Tool SHALL 空のフィールドのみに補完結果を適用する
5. WHEN AI_Enrichment が suggestedTags を返す, THE Enrich_Bookmark_Tool SHALL 各タグを Tag テーブルで検索し、存在しなければ作成して BookmarkTag で関連付ける
6. IF OGP_Metadata の取得が失敗する, THEN THE Bookmark_Agent SHALL Bookmark レコードを維持し、AI_Enrichment を URL 情報のみで実行する
7. IF AI_Enrichment が失敗する, THEN THE Bookmark_Agent SHALL エラーをログに記録し、OGP 情報のみが適用された Bookmark を維持する

### Requirement 4: エージェントからのブックマーク更新

**User Story:** As a ユーザー, I want エージェントにブックマークのタグ付け、Collection 割り当て、メモ追加を依頼する, so that チャットで指示するだけでブックマークを整理できる。

#### Acceptance Criteria

1. WHEN ユーザーがブックマークの更新を依頼する, THE Update_Bookmark_Tool SHALL 指定された Bookmark の owner フィールドが現在の Owner_Id と一致することを検証する
2. WHEN owner 検証が成功する, THE Update_Bookmark_Tool SHALL 指定されたフィールド（memo、title、description、status）を更新する
3. WHEN ユーザーがタグの追加を依頼する, THE Update_Bookmark_Tool SHALL Tag テーブルで該当タグを検索し、存在しなければ新規作成して BookmarkTag レコードで関連付ける
4. WHEN ユーザーがタグの削除を依頼する, THE Update_Bookmark_Tool SHALL 該当する BookmarkTag レコードを削除する
5. WHEN ユーザーが Collection への割り当てを依頼する, THE Update_Bookmark_Tool SHALL Collection テーブルで該当 Collection を検索し、存在しなければ新規作成して BookmarkCollection レコードで関連付ける
6. WHEN ユーザーが Collection からの削除を依頼する, THE Update_Bookmark_Tool SHALL 該当する BookmarkCollection レコードを削除する
7. IF 指定された Bookmark が存在しない, THEN THE Update_Bookmark_Tool SHALL 「ブックマークが見つかりません」メッセージを返す
8. IF owner フィールドが現在の Owner_Id と一致しない, THEN THE Update_Bookmark_Tool SHALL 「ブックマークが見つかりません」メッセージを返す（存在を明かさない）

### Requirement 5: エージェントからのブックマーク削除

**User Story:** As a ユーザー, I want エージェントにブックマークの削除を依頼する, so that 不要なブックマークをチャットから整理できる。

#### Acceptance Criteria

1. WHEN ユーザーがブックマークの削除を依頼する, THE Delete_Bookmark_Tool SHALL 指定された Bookmark の owner フィールドが現在の Owner_Id と一致することを検証する
2. WHEN owner 検証が成功する, THE Delete_Bookmark_Tool SHALL 関連する BookmarkTag レコードを全て削除する
3. WHEN 関連する BookmarkTag レコードの削除が完了する, THE Delete_Bookmark_Tool SHALL 関連する BookmarkCollection レコードを全て削除する
4. WHEN 関連レコードの削除が完了する, THE Delete_Bookmark_Tool SHALL Bookmark レコードを削除する
5. WHEN 削除が成功する, THE Delete_Bookmark_Tool SHALL 削除されたブックマークのタイトルと URL を含む成功メッセージを返す
6. IF 指定された Bookmark が存在しない, THEN THE Delete_Bookmark_Tool SHALL 「ブックマークが見つかりません」メッセージを返す
7. IF owner フィールドが現在の Owner_Id と一致しない, THEN THE Delete_Bookmark_Tool SHALL 「ブックマークが見つかりません」メッセージを返す（存在を明かさない）
8. IF 削除処理中にエラーが発生する, THEN THE Delete_Bookmark_Tool SHALL エラーメッセージを返す

### Requirement 6: エージェントからの AI 補完トリガー

**User Story:** As a ユーザー, I want 既存のブックマークに対してエージェントに AI 補完を実行してもらう, so that 過去に登録したブックマークにもタグやメモを自動付与できる。

#### Acceptance Criteria

1. WHEN ユーザーが既存ブックマークへの AI 補完を依頼する, THE Enrich_Bookmark_Tool SHALL 指定された Bookmark の owner フィールドが現在の Owner_Id と一致することを検証する
2. WHEN owner 検証が成功する, THE Enrich_Bookmark_Tool SHALL Bookmark の URL と既存メタデータを使用して AI_Enrichment を実行する
3. WHEN AI_Enrichment の結果を受け取る, THE Enrich_Bookmark_Tool SHALL 空のフィールドのみに補完結果を適用する
4. WHEN AI_Enrichment が suggestedTags を返す, THE Enrich_Bookmark_Tool SHALL 各タグを Tag テーブルで検索し、存在しなければ作成して BookmarkTag で関連付ける
5. WHEN AI_Enrichment が suggestedCollection を返す, THE Enrich_Bookmark_Tool SHALL Collection テーブルで検索し、存在しなければ作成して BookmarkCollection で関連付ける
6. WHEN 補完が成功する, THE Enrich_Bookmark_Tool SHALL 適用された補完内容（追加されたタグ、メモ、Collection 等）のサマリーを返す
7. IF 指定された Bookmark が存在しないまたは owner が一致しない, THEN THE Enrich_Bookmark_Tool SHALL 「ブックマークが見つかりません」メッセージを返す
8. IF AI_Enrichment API の呼び出しが失敗する, THEN THE Enrich_Bookmark_Tool SHALL エラーメッセージを返し、既存の Bookmark データを変更しない
