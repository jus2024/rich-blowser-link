# Requirements Document

## Introduction

ブラウザのデフォルトお気に入り機能では整理しきれないリンクを、タグ付け・カテゴリ分け・全文検索・OGP プレビューなどのリッチな機能で管理できる Web アプリケーション。認証済みユーザーが自分のリンクコレクションを構築・整理・検索できることを目的とする。

## Glossary

- **Link_Manager**: リンクの CRUD 操作、検索、フィルタリングを担当するシステム全体
- **Bookmark**: ユーザーが保存する URL とそのメタデータ（タイトル、説明、OGP 情報）を含むデータエンティティ
- **Tag**: Bookmark に付与される自由入力のラベル。1 つの Bookmark に複数付与可能
- **Collection**: Bookmark をグループ化するためのフォルダ的な分類単位
- **OGP_Fetcher**: URL から Open Graph Protocol メタデータ（タイトル、説明、画像）を取得するサブシステム
- **Search_Engine**: Bookmark のタイトル、説明、URL、タグを対象に全文検索を行うサブシステム
- **Authenticated_User**: Cognito で認証済みのログインユーザー
- **Bookmark_Agent**: Authenticated_User の Bookmark コレクションを検索し、自然言語の質問に回答する AI エージェント。Strands Agents SDK で実装し AgentCore Runtime 上で実行される
- **Agent_Chat**: Bookmark_Agent と対話するためのチャット UI コンポーネント
- **Bookmark_Importer**: Netscape Bookmark File Format（Chrome エクスポート HTML）をパースし、Bookmark と Collection を一括作成するサブシステム
- **Netscape_Bookmark_File**: Google Chrome がエクスポートする HTML 形式のブックマークファイル。`<!DOCTYPE NETSCAPE-Bookmark-file-1>` で始まり、`<DT><A>` タグで各ブックマークを、`<DT><H3>` タグでフォルダ構造を表現する
- **Import_Job**: 1 回のインポート操作全体を表す処理単位。進捗状態（待機中・処理中・完了・エラー）を持つ

## Requirements

### Requirement 1: Bookmark の作成

**User Story:** As an Authenticated_User, I want to URL を入力して Bookmark を保存する, so that 後から参照したいリンクを管理できる。

#### Acceptance Criteria

1. WHEN Authenticated_User が有効な URL（RFC 3986 準拠、スキームが http または https、最大 2048 文字）を入力して保存を実行する, THE Link_Manager SHALL Bookmark を作成し DynamoDB に永続化する
2. WHEN Bookmark が作成される, THE OGP_Fetcher SHALL 10 秒以内に対象 URL から OGP メタデータ（タイトル：最大 200 文字、説明：最大 500 文字、画像 URL：最大 2048 文字）を取得し Bookmark に付与する
3. IF OGP メタデータの取得に失敗する（タイムアウトまたはネットワークエラー）, THEN THE Link_Manager SHALL URL のみで Bookmark を作成し、タイトルフィールドを空文字列として保存する
4. WHEN Bookmark が作成される, THE Link_Manager SHALL 作成日時を ISO 8601 形式で自動的に記録する
5. IF Authenticated_User が既に保存済みの URL と同一の URL を保存しようとする, THEN THE Link_Manager SHALL 重複している旨を示すメッセージを表示し、保存を続行するか中止するかの選択肢を提示する
6. IF Authenticated_User が重複確認で中止を選択する, THEN THE Link_Manager SHALL Bookmark を作成せず、入力画面の状態を維持する
7. IF Authenticated_User が入力した URL がスキーム http/https でない、または 2048 文字を超える, THEN THE Link_Manager SHALL 入力値が無効であることを示すエラーメッセージを表示し、Bookmark を作成しない

### Requirement 2: Bookmark の一覧表示

**User Story:** As an Authenticated_User, I want to 保存した Bookmark を一覧で確認する, so that 自分のリンクコレクション全体を把握できる。

#### Acceptance Criteria

1. WHEN Authenticated_User がトップページにアクセスする, THE Link_Manager SHALL 当該ユーザーの Bookmark 一覧を作成日時の降順で最大 20 件表示する
2. THE Link_Manager SHALL 各 Bookmark のタイトル、URL、OGP 画像サムネイル、付与された Tag 一覧を表示する
3. WHEN Authenticated_User が一覧の末尾までスクロールする, THE Link_Manager SHALL 次の 20 件の Bookmark を追加で読み込み一覧に追加表示する
4. THE Link_Manager SHALL 他の Authenticated_User の Bookmark を表示しない
5. IF Authenticated_User の Bookmark が 0 件の場合, THEN THE Link_Manager SHALL Bookmark が未登録であることを示すメッセージと新規作成への導線を表示する

### Requirement 3: Bookmark の編集と削除

**User Story:** As an Authenticated_User, I want to Bookmark のタイトルやメモを編集・削除する, so that 情報を最新に保てる。

#### Acceptance Criteria

1. WHEN Authenticated_User が Bookmark の編集を実行する, THE Link_Manager SHALL タイトル（最大200文字）、説明（最大1000文字）、メモ（最大2000文字）フィールドの更新を永続化する
2. IF Bookmark の編集時にタイトルが空文字列である, THEN THE Link_Manager SHALL バリデーションエラーを表示し更新を実行しない
3. WHEN Authenticated_User が Bookmark の削除を実行する, THE Link_Manager SHALL 確認ダイアログを表示し、Authenticated_User が確認した場合に Bookmark および関連する Tag 紐付けと Collection 紐付けを削除する
4. IF Authenticated_User が削除の確認ダイアログでキャンセルを選択する, THEN THE Link_Manager SHALL Bookmark を削除せず元の状態を維持する
5. IF Authenticated_User が Bookmark の所有者でない, THEN THE Link_Manager SHALL 編集・削除操作を拒否し、権限がない旨のエラーメッセージを表示する
6. IF Bookmark の編集または削除の永続化に失敗する, THEN THE Link_Manager SHALL 操作失敗を示すエラーメッセージを表示し、変更前のデータを維持する

### Requirement 4: Tag 管理

**User Story:** As an Authenticated_User, I want to Bookmark にタグを付与・管理する, so that 横断的な分類でリンクを整理できる。

#### Acceptance Criteria

1. WHEN Bookmark を作成または編集する, THE Link_Manager SHALL 1 つ以上最大 20 個の Tag を付与できるインターフェースを提供する
2. WHEN Authenticated_User が Tag 入力フィールドに 1 文字以上入力する, THE Link_Manager SHALL 前方一致する既存 Tag を最大 10 件オートコンプリート候補として表示する
3. WHEN Authenticated_User が複数の Tag 名を指定してフィルタする, THE Link_Manager SHALL 指定されたすべての Tag が付与された Bookmark のみを表示する（AND 条件）
4. THE Link_Manager SHALL 各 Tag に紐づく Bookmark 数を表示する
5. IF Tag 名が空文字または 30 文字を超える場合, THEN THE Link_Manager SHALL 付与を拒否し、文字数制限を示すエラーメッセージを表示する
6. WHEN Authenticated_User が Tag を削除する, THE Link_Manager SHALL 当該 Tag と Bookmark の紐づけをすべて解除し、Tag を削除する
7. WHEN Authenticated_User が Tag 名を変更する, THE Link_Manager SHALL 当該 Tag が付与されたすべての Bookmark に変更後の Tag 名を反映する

### Requirement 5: Collection 管理

**User Story:** As an Authenticated_User, I want to Bookmark を Collection に分類する, so that 目的別にリンクをグループ化できる。

#### Acceptance Criteria

1. WHEN Authenticated_User が Collection を作成する, THE Link_Manager SHALL 1文字以上100文字以下の Collection 名と、0文字以上500文字以下の任意の説明を保存する
2. WHEN Authenticated_User が Bookmark を Collection に追加する, THE Link_Manager SHALL Bookmark と Collection の関連を永続化し、同一 Bookmark が既に当該 Collection に所属している場合は重複を作成せず成功として扱う
3. THE Link_Manager SHALL 1 つの Bookmark を複数の Collection に所属させることができる
4. WHEN Authenticated_User が Collection を選択する, THE Link_Manager SHALL 当該 Collection に属する Bookmark のみを表示する
5. THE Link_Manager SHALL Collection に属さない Bookmark を「未分類」として表示する
6. IF Authenticated_User が Collection 名を空文字または100文字超で作成しようとした場合, THEN THE Link_Manager SHALL 作成を拒否し、入力制約を示すエラーメッセージを表示する
7. WHEN Authenticated_User が Collection を削除する, THE Link_Manager SHALL 当該 Collection を削除し、所属していた Bookmark は削除せず保持する
8. IF Authenticated_User が同一の Collection 名で Collection を作成しようとした場合, THEN THE Link_Manager SHALL 作成を拒否し、名前が重複していることを示すエラーメッセージを表示する

### Requirement 6: 全文検索

**User Story:** As an Authenticated_User, I want to キーワードで Bookmark を検索する, so that 大量のリンクから目的のものを素早く見つけられる。

#### Acceptance Criteria

1. WHEN Authenticated_User が1文字以上200文字以内の検索キーワードを入力する, THE Search_Engine SHALL Bookmark のタイトル、説明、URL、Tag を対象に部分一致検索を実行し、一致したフィールド数が多い順に最大50件の結果を表示する
2. WHILE 検索キーワードが入力されている, THE Search_Engine SHALL 300ms のデバウンス後にリアルタイムで検索結果を更新する
3. THE Search_Engine SHALL 当該 Authenticated_User の Bookmark のみを検索対象とする
4. IF 検索結果が0件の場合, THEN THE Search_Engine SHALL 該当する Bookmark がない旨のメッセージを表示する
5. IF 検索キーワードが200文字を超える場合, THEN THE Search_Engine SHALL 入力を200文字で切り詰め、切り詰められた文字列で検索を実行する

### Requirement 7: OGP プレビュー表示

**User Story:** As an Authenticated_User, I want to リンクのプレビュー（タイトル、説明、画像）を確認する, so that リンク先の内容を開かずに把握できる。

#### Acceptance Criteria

1. THE Link_Manager SHALL Bookmark 一覧で OGP 画像をサムネイルとして表示する
2. WHEN Authenticated_User が Bookmark にホバーまたはタップする, THE Link_Manager SHALL 200ms 以上ホバーが継続した後に OGP メタデータ（タイトル、説明文先頭 120 文字、画像）をプレビューカードとして表示する
3. IF OGP 画像が存在しない Bookmark の場合, THEN THE Link_Manager SHALL デフォルトのプレースホルダー画像をサムネイルおよびプレビューカードに表示する
4. WHEN Authenticated_User がプレビューカード表示中に Bookmark からホバーアウトまたは他の要素をタップする, THE Link_Manager SHALL プレビューカードを非表示にする
5. IF OGP タイトルまたは説明が存在しない Bookmark の場合, THEN THE Link_Manager SHALL タイトル欠落時は URL をタイトルとして表示し、説明欠落時は説明欄を非表示にする

### Requirement 8: 認証とデータ分離

**User Story:** As an Authenticated_User, I want to 自分のデータが他のユーザーからアクセスされない, so that プライベートなリンクコレクションを安全に管理できる。

#### Acceptance Criteria

1. THE Link_Manager SHALL 未認証ユーザーによる保護対象ページへのアクセスをログイン画面にリダイレクトする
2. THE Link_Manager SHALL すべてのデータ操作（作成・読取・更新・削除）で Cognito の認証トークンを検証する
3. WHEN Bookmark、Tag、または Collection が作成されるとき、THE Link_Manager SHALL 操作を実行した Authenticated_User の Cognito ユーザー ID を所有者として自動的に記録する
4. WHEN データクエリが実行されるとき、THE Link_Manager SHALL リクエスト元の Authenticated_User が所有するデータのみを返却し、他ユーザーのデータを結果に含めない
5. IF 認証トークンが無効または有効期限切れである場合、THEN THE Link_Manager SHALL データ操作を拒否し、ユーザーをログイン画面にリダイレクトする
6. IF ユーザーが自身の所有でないリソースに対して直接アクセスを試みた場合、THEN THE Link_Manager SHALL 該当リソースが存在しないものとして扱い、データを返却しない

### Requirement 9: AI エージェントチャットによる Bookmark 検索

**User Story:** As an Authenticated_User, I want to 自然言語で「XXXのリンクどれだっけ？」のように質問する, so that Bookmark を手動で探さずに目的のリンクを素早く見つけられる。

#### Acceptance Criteria

1. THE Agent_Chat SHALL トップページにサブセクションとしてチャット UI を表示する
2. WHEN Authenticated_User が自然言語で質問を送信する, THE Bookmark_Agent SHALL 当該ユーザーの Bookmark コレクション（タイトル、URL、説明、Tag）を検索し、関連する Bookmark の情報を含む回答を返す
3. THE Bookmark_Agent SHALL 当該 Authenticated_User が所有する Bookmark のみを検索対象とし、他ユーザーのデータにアクセスしない
4. WHEN Bookmark_Agent が該当する Bookmark を特定できた場合, THE Agent_Chat SHALL 回答にタイトルと URL を含めて表示する
5. IF Bookmark_Agent が該当する Bookmark を特定できない場合, THEN THE Bookmark_Agent SHALL 該当する Bookmark が見つからなかった旨を回答する
6. THE Bookmark_Agent SHALL Strands Agents SDK を使用して実装し、AgentCore Runtime 上で実行する
7. WHEN Authenticated_User がチャットメッセージを送信する, THE Agent_Chat SHALL AgentCore Runtime の HTTP SSE エンドポイント経由で Bookmark_Agent を呼び出し、レスポンスをストリーミング表示する
8. IF AgentCore Runtime が未設定（環境変数 NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN が未設定）の場合, THEN THE Agent_Chat SHALL Runtime が未設定である旨のメッセージを表示し、メッセージ送信を無効化する
9. IF AgentCore Runtime との通信に失敗する場合, THEN THE Agent_Chat SHALL エラーメッセージを表示し、直前の会話履歴を維持する
10. THE Agent_Chat SHALL 認証トークン（Cognito）を AgentCore Runtime への各リクエストに付与し、未認証状態ではチャット機能を利用不可とする

### Requirement 10: Chrome ブックマークインポート

**User Story:** As an Authenticated_User, I want to Google Chrome のブックマークエクスポートファイルをアップロードしてインポートする, so that 既存のブックマークを手動で一つずつ登録せずに一括で移行できる。

#### Acceptance Criteria

1. WHEN Authenticated_User が Netscape Bookmark File Format に準拠した HTML ファイル（最大 10MB）をアップロードする, THE Bookmark_Importer SHALL ファイルをパースし、含まれるブックマーク数とフォルダ構造のプレビューを表示する
2. IF アップロードされたファイルが Netscape Bookmark File Format に準拠しない（`<!DOCTYPE NETSCAPE-Bookmark-file-1>` ヘッダーが存在しない、または HTML として解析不能）, THEN THE Bookmark_Importer SHALL インポートを拒否し、ファイル形式が不正である旨のエラーメッセージを表示する
3. WHEN Bookmark_Importer がファイルをパースする, THE Bookmark_Importer SHALL `<DT><H3>` タグで定義されたフォルダ構造を Collection に変換し、ネストされたフォルダは「親フォルダ名/子フォルダ名」形式のフラットな Collection 名として作成する
4. WHEN Bookmark_Importer がファイルをパースする, THE Bookmark_Importer SHALL `<DT><A>` タグで定義された各ブックマークの URL と HREF 属性を Bookmark の url フィールドに、テキストコンテンツを title フィールドに設定して Bookmark を作成する
5. WHEN Authenticated_User がインポートを確認する, THE Bookmark_Importer SHALL Bookmark を 50 件ずつのバッチに分割して順次作成し、各バッチ完了後にインポート進捗（処理済み件数/全件数、パーセンテージ）を更新表示する
6. WHEN インポート処理が進行中である, THE Bookmark_Importer SHALL 処理済み件数、全件数、現在のパーセンテージ、および推定残り時間をプログレスバーとともに表示する
7. IF インポート対象の URL が Authenticated_User の既存 Bookmark に存在する, THEN THE Bookmark_Importer SHALL 重複を検出し、インポート開始前に重複件数を表示して「スキップ」（重複を無視して新規のみインポート）または「マージ」（既存 Bookmark のタイトルをインポート元で上書き）の選択肢を提示する
8. IF Authenticated_User が重複処理で「スキップ」を選択する, THEN THE Bookmark_Importer SHALL 重複 URL の Bookmark を作成せず、重複でない Bookmark のみを作成する
9. IF Authenticated_User が重複処理で「マージ」を選択する, THEN THE Bookmark_Importer SHALL 重複 URL の既存 Bookmark のタイトルをインポート元のタイトルで更新し、Collection 紐付けを追加する
10. WHEN すべての Bookmark が作成された後, THE OGP_Fetcher SHALL バックグラウンドで各 Bookmark の OGP メタデータを順次取得し、取得完了した Bookmark から順に OGP 情報を更新する
11. IF バッチ処理中に個別の Bookmark 作成が失敗する, THEN THE Bookmark_Importer SHALL 失敗した Bookmark をスキップして処理を継続し、インポート完了後に失敗件数と失敗した URL の一覧を表示する
12. WHEN インポートが完了する, THE Bookmark_Importer SHALL インポート結果サマリー（成功件数、スキップ件数、失敗件数、作成された Collection 数）を表示する
13. THE Bookmark_Importer SHALL パース処理において、`<DT><A>` タグの HREF 属性値が http または https スキームでない場合、当該ブックマークをスキップする
14. FOR ALL 有効な Netscape Bookmark File Format ファイルに対して、パースした後にエクスポート形式で再構成した場合、元のファイルに含まれるすべての有効な URL とフォルダ構造が保持される（ラウンドトリップ特性）
