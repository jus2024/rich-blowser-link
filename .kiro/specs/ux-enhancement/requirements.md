# Requirements Document

## Introduction

Rich Browser Link アプリケーションの UX を 3 つの優先改善領域で強化する。(1) Collection 操作 UI の完全実装、(2) 表示モード切替とファビコン自動取得、(3) Read Later（あとで読む）ステータス管理とソート機能の追加。既存の Amplify Gen 2 バックエンド（DynamoDB + Cognito）とフロントエンド（Next.js + TypeScript）を拡張し、ユーザーの Bookmark 管理体験を向上させる。

## Glossary

- **Link_Manager**: リンクの CRUD 操作、検索、フィルタリング、表示を担当するシステム全体
- **Bookmark**: ユーザーが保存する URL とそのメタデータ（タイトル、説明、OGP 情報、ステータス、アクセス統計）を含むデータエンティティ
- **Collection**: Bookmark をグループ化するためのフォルダ的な分類単位
- **BookmarkCollection**: Bookmark と Collection の多対多関連を表す中間テーブルレコード
- **Collection_UI**: Collection の作成・編集・削除・Bookmark 割り当てを行うユーザーインターフェース群
- **Display_Mode_Switcher**: Bookmark 一覧の表示形式（リスト・グリッド・コンパクト）を切り替える UI コンポーネント
- **Favicon_Fetcher**: Bookmark の URL ドメインからファビコン画像を取得・キャッシュするサブシステム
- **Bookmark_Status**: Bookmark の閲覧状態を表す列挙値（inbox / read / archived）
- **Sort_Controller**: Bookmark 一覧のソート条件（作成日時・最終アクセス日時・アクセス回数）を制御するサブシステム
- **Access_Tracker**: Bookmark リンクのクリックを検知し、アクセス回数と最終アクセス日時を記録するサブシステム
- **Authenticated_User**: Cognito で認証済みのログインユーザー
- **User_Preference**: 表示モードなどのユーザー設定を永続化するストレージ（localStorage）

## Requirements

### Requirement 1: Collection の作成

**User Story:** As an Authenticated_User, I want to サイドバーから新しい Collection を作成する, so that Bookmark を目的別にグループ化できる。

#### Acceptance Criteria

1. WHEN Authenticated_User がサイドバーの「新規作成」ボタンをクリックする, THE Collection_UI SHALL Collection 名入力フィールドと説明入力フィールドを含む作成フォームを表示する
2. WHEN Authenticated_User が 1 文字以上 100 文字以下の Collection 名を入力して保存を実行する, THE Link_Manager SHALL Collection を作成し DynamoDB に永続化する
3. WHEN Collection が作成される, THE Collection_UI SHALL サイドバーの Collection 一覧に新しい Collection を即座に追加表示する
4. IF Authenticated_User が Collection 名を空文字または 100 文字超で保存しようとする, THEN THE Collection_UI SHALL 入力制約を示すインラインエラーメッセージを表示し、保存を実行しない
5. IF Authenticated_User が既存の Collection と同一の名前で作成しようとする, THEN THE Collection_UI SHALL 名前が重複していることを示すエラーメッセージを表示し、作成を実行しない
6. WHEN Authenticated_User が作成フォームでキャンセルを選択する, THE Collection_UI SHALL フォームを閉じ、入力内容を破棄する

### Requirement 2: Collection の編集

**User Story:** As an Authenticated_User, I want to 既存の Collection の名前や説明を変更する, so that Collection の整理を柔軟に行える。

#### Acceptance Criteria

1. WHEN Authenticated_User がサイドバーの Collection 項目の編集アクションを選択する, THE Collection_UI SHALL 現在の名前と説明が入力済みの編集フォームを表示する
2. WHEN Authenticated_User が有効な名前（1-100 文字）と説明（0-500 文字）で保存を実行する, THE Link_Manager SHALL Collection の名前と説明を更新し DynamoDB に永続化する
3. IF 変更後の名前が他の既存 Collection と重複する, THEN THE Collection_UI SHALL 名前が重複していることを示すエラーメッセージを表示し、更新を実行しない
4. WHEN Collection の更新が完了する, THE Collection_UI SHALL サイドバーの表示を更新後の名前で即座に反映する

### Requirement 3: Collection の削除

**User Story:** As an Authenticated_User, I want to 不要な Collection を削除する, so that サイドバーを整理できる。

#### Acceptance Criteria

1. WHEN Authenticated_User がサイドバーの Collection 項目の削除アクションを選択する, THE Collection_UI SHALL 削除確認ダイアログを表示する
2. WHEN Authenticated_User が削除を確認する, THE Link_Manager SHALL 当該 Collection と関連する BookmarkCollection レコードを削除し、所属していた Bookmark は削除せず保持する
3. IF Authenticated_User が削除確認ダイアログでキャンセルを選択する, THEN THE Collection_UI SHALL Collection を削除せず元の状態を維持する
4. WHEN Collection が削除される, THE Collection_UI SHALL サイドバーから当該 Collection を即座に除去し、選択状態を「すべて」にリセットする

### Requirement 4: Bookmark の Collection 割り当て

**User Story:** As an Authenticated_User, I want to Bookmark を任意の Collection に追加・解除する, so that Bookmark を柔軟に分類できる。

#### Acceptance Criteria

1. WHEN Authenticated_User が Bookmark カードの Collection 割り当てアクションを選択する, THE Collection_UI SHALL 全 Collection のチェックボックス付きドロップダウンリストを表示し、当該 Bookmark が既に所属する Collection にはチェックを入れた状態で表示する
2. WHEN Authenticated_User がドロップダウンで Collection のチェックを追加する, THE Link_Manager SHALL 当該 Bookmark と Collection の関連を作成し DynamoDB に永続化する
3. WHEN Authenticated_User がドロップダウンで Collection のチェックを解除する, THE Link_Manager SHALL 当該 Bookmark と Collection の関連を削除する
4. IF 同一 Bookmark が既に当該 Collection に所属している状態で追加操作が実行される, THEN THE Link_Manager SHALL 重複を作成せず成功として扱う
5. THE Link_Manager SHALL 1 つの Bookmark を複数の Collection に同時に所属させることができる

### Requirement 5: 表示モード切替（リスト表示）

**User Story:** As an Authenticated_User, I want to Bookmark 一覧をリスト形式で表示する, so that 現在のタイル表示と同等の情報を確認できる。

#### Acceptance Criteria

1. THE Display_Mode_Switcher SHALL Bookmark 一覧の上部にリスト・グリッド・コンパクトの 3 つの表示モード切替ボタンを表示する
2. WHEN Authenticated_User がリストモードを選択する, THE Link_Manager SHALL 各 Bookmark をタイトル、URL、OGP サムネイル、Tag 一覧、ファビコンを含む横長カード形式で表示する
3. THE Link_Manager SHALL リストモードをデフォルトの表示モードとして使用する

### Requirement 6: 表示モード切替（グリッド表示）

**User Story:** As an Authenticated_User, I want to Bookmark 一覧を Pinterest 風のグリッド形式で表示する, so that OGP 画像を大きく確認しながらブラウズできる。

#### Acceptance Criteria

1. WHEN Authenticated_User がグリッドモードを選択する, THE Link_Manager SHALL 各 Bookmark を OGP 画像を大きく表示したカード形式で、複数列のグリッドレイアウトで表示する
2. THE Link_Manager SHALL グリッドモードで各カードに OGP 画像（幅いっぱい）、タイトル、ファビコン、Tag バッジを表示する
3. IF Bookmark に OGP 画像が存在しない, THEN THE Link_Manager SHALL ファビコンを拡大表示したプレースホルダーカードを表示する

### Requirement 7: 表示モード切替（コンパクト表示）

**User Story:** As an Authenticated_User, I want to Bookmark 一覧を高密度なコンパクト形式で表示する, so that 多数の Bookmark を一度に確認できる。

#### Acceptance Criteria

1. WHEN Authenticated_User がコンパクトモードを選択する, THE Link_Manager SHALL 各 Bookmark をファビコン、タイトル、URL のみの 1 行形式で表示する
2. THE Link_Manager SHALL コンパクトモードで OGP 画像と説明を非表示にし、行間を最小限に抑える
3. THE Link_Manager SHALL コンパクトモードで各行にホバー時のみ編集・削除アクションを表示する

### Requirement 8: 表示モード設定の永続化

**User Story:** As an Authenticated_User, I want to 選択した表示モードが次回アクセス時にも維持される, so that 毎回切り替える手間を省ける。

#### Acceptance Criteria

1. WHEN Authenticated_User が表示モードを切り替える, THE Link_Manager SHALL 選択されたモード（list / grid / compact）を localStorage に保存する
2. WHEN Authenticated_User がトップページにアクセスする, THE Link_Manager SHALL localStorage から保存済みの表示モードを読み込み、該当モードで Bookmark 一覧を表示する
3. IF localStorage に表示モード設定が存在しない, THEN THE Link_Manager SHALL リストモードをデフォルトとして使用する

### Requirement 9: ファビコン自動取得

**User Story:** As an Authenticated_User, I want to 各 Bookmark のドメインのファビコンが自動的に表示される, so that OGP 画像がない Bookmark でも視覚的に識別できる。

#### Acceptance Criteria

1. THE Favicon_Fetcher SHALL Bookmark の URL からドメインを抽出し、Google Favicon API（`https://www.google.com/s2/favicons?domain={domain}&sz=32`）経由でファビコン画像 URL を生成する
2. THE Link_Manager SHALL すべての表示モード（リスト・グリッド・コンパクト）で各 Bookmark のファビコンを表示する
3. IF ファビコンの読み込みに失敗する（画像ロードエラー）, THEN THE Link_Manager SHALL デフォルトのグローブアイコンをフォールバックとして表示する
4. THE Favicon_Fetcher SHALL ファビコン URL をクライアントサイドで動的に生成し、サーバーサイドでの保存を行わない

### Requirement 10: Bookmark ステータス管理

**User Story:** As an Authenticated_User, I want to Bookmark に「あとで読む」「既読」「アーカイブ」のステータスを設定する, so that 閲覧状態を管理できる。

#### Acceptance Criteria

1. THE Link_Manager SHALL 各 Bookmark に status フィールド（inbox / read / archived）を持たせ、デフォルト値を inbox とする
2. WHEN Authenticated_User が Bookmark のステータス変更アクションを選択する, THE Link_Manager SHALL inbox・read・archived の選択肢を表示する
3. WHEN Authenticated_User がステータスを選択する, THE Link_Manager SHALL Bookmark の status フィールドを更新し DynamoDB に永続化する
4. WHEN Bookmark が新規作成される, THE Link_Manager SHALL status を inbox に自動設定する
5. THE Link_Manager SHALL 各 Bookmark カードにステータスを示すバッジまたはアイコンを表示する

### Requirement 11: Read Later フィルター

**User Story:** As an Authenticated_User, I want to 「あとで読む」ステータスの Bookmark だけを表示する, so that 未読のリンクに集中できる。

#### Acceptance Criteria

1. THE Link_Manager SHALL サイドバーに「あとで読む」（inbox）、「既読」（read）、「アーカイブ」（archived）のステータスフィルターセクションを表示する
2. WHEN Authenticated_User がステータスフィルターを選択する, THE Link_Manager SHALL 選択されたステータスに一致する Bookmark のみを表示する
3. WHEN ステータスフィルターが選択されている状態で Collection フィルターも選択されている, THE Link_Manager SHALL 両方の条件を AND で適用した結果を表示する
4. THE Link_Manager SHALL 各ステータスフィルター項目に該当する Bookmark 件数を表示する

### Requirement 12: アクセス回数の追跡

**User Story:** As an Authenticated_User, I want to Bookmark リンクをクリックした回数が記録される, so that よく使うリンクを把握できる。

#### Acceptance Criteria

1. WHEN Authenticated_User が Bookmark カードの URL リンクをクリックする, THE Access_Tracker SHALL 当該 Bookmark の accessCount フィールドを 1 インクリメントし DynamoDB に永続化する
2. WHEN Authenticated_User が Bookmark カードの URL リンクをクリックする, THE Access_Tracker SHALL 当該 Bookmark の lastAccessedAt フィールドを現在の ISO 8601 日時で更新する
3. THE Link_Manager SHALL 新規作成された Bookmark の accessCount を 0、lastAccessedAt を空文字列に初期化する
4. THE Access_Tracker SHALL リンククリック後にリンク先を新しいタブで開く動作を妨げない

### Requirement 13: ソート機能

**User Story:** As an Authenticated_User, I want to Bookmark 一覧を作成日時・最終アクセス日時・アクセス回数でソートする, so that 目的に応じた順序で Bookmark を確認できる。

#### Acceptance Criteria

1. THE Sort_Controller SHALL Bookmark 一覧の上部にソート条件選択 UI（作成日時・最終アクセス日時・アクセス回数）を表示する
2. WHEN Authenticated_User が「作成日時」ソートを選択する, THE Link_Manager SHALL Bookmark 一覧を createdAt の降順で表示する
3. WHEN Authenticated_User が「最終アクセス日時」ソートを選択する, THE Link_Manager SHALL Bookmark 一覧を lastAccessedAt の降順で表示し、未アクセス（lastAccessedAt が空）の Bookmark を末尾に配置する
4. WHEN Authenticated_User が「アクセス回数」ソートを選択する, THE Link_Manager SHALL Bookmark 一覧を accessCount の降順で表示する
5. THE Link_Manager SHALL 「作成日時」をデフォルトのソート条件として使用する

### Requirement 14: データモデル拡張

**User Story:** As a developer, I want to Bookmark モデルにステータスとアクセス統計フィールドを追加する, so that Read Later 機能とソート機能のデータを永続化できる。

#### Acceptance Criteria

1. THE Link_Manager SHALL Bookmark モデルに status フィールド（文字列型、デフォルト値 "inbox"）を追加する
2. THE Link_Manager SHALL Bookmark モデルに accessCount フィールド（整数型、デフォルト値 0）を追加する
3. THE Link_Manager SHALL Bookmark モデルに lastAccessedAt フィールド（日時型、任意）を追加する
4. THE Link_Manager SHALL 既存の Bookmark データに対して status フィールドが未設定の場合、表示時に "inbox" として扱う
5. THE Link_Manager SHALL 既存の Bookmark データに対して accessCount フィールドが未設定の場合、表示時に 0 として扱う
