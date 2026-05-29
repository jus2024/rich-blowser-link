# Requirements Document

## Introduction

QuickAdd コンポーネントにタイトル入力欄を追加し、ユーザーが URL と同時に任意でタイトルを指定できるようにする。ユーザーが入力したタイトルは OGP フェッチや AI 補完で取得されるタイトルよりも優先される。タイトル欄は任意入力であり、空の場合は従来通り OGP → AI 補完パイプラインがタイトルを自動設定する。

## Glossary

- **QuickAdd**: URL を入力して Enter キーで即座にブックマークを登録するフロントエンドコンポーネント
- **OGP_Fetcher**: URL から Open Graph Protocol メタデータ（タイトル、説明、画像 URL）を取得するバックグラウンド処理
- **AI_Enricher**: OGP 取得後にタグ、メモ、タイトル、説明、Collection 振り分けを AI で補完するパイプライン処理
- **Bookmark**: ユーザーが保存する URL とそのメタデータ（タイトル、説明、メモ、OGP 画像など）のエンティティ
- **User_Title**: QuickAdd のタイトル入力欄にユーザーが手動で入力したタイトル文字列

## Requirements

### Requirement 1: タイトル入力欄の表示

**User Story:** As a ユーザー, I want QuickAdd にタイトル入力欄が表示される, so that URL 登録時にタイトルを手動で指定できる。

#### Acceptance Criteria

1. THE QuickAdd SHALL URL 入力欄に加えてタイトル入力欄を表示する
2. THE QuickAdd SHALL タイトル入力欄を任意入力として扱い、空のまま送信を許可する
3. THE QuickAdd SHALL タイトル入力欄に適切なプレースホルダーテキストを表示する
4. THE QuickAdd SHALL タイトル入力欄に最大200文字の入力制限を設ける

### Requirement 2: タイトル付きブックマーク登録

**User Story:** As a ユーザー, I want タイトルを入力して登録したとき、そのタイトルがブックマークに保存される, so that 自分で指定したタイトルでブックマークを管理できる。

#### Acceptance Criteria

1. WHEN ユーザーがタイトルを入力して送信した場合, THE QuickAdd SHALL 入力された URL とタイトルの両方を使用してブックマークを作成する
2. WHEN ユーザーがタイトルを空のまま送信した場合, THE QuickAdd SHALL URL のみを使用してブックマークを作成する
3. WHEN ブックマーク作成が成功した場合, THE QuickAdd SHALL URL 入力欄とタイトル入力欄の両方をクリアする

### Requirement 3: OGP フェッチ時のタイトル優先制御

**User Story:** As a ユーザー, I want 手動入力したタイトルが OGP タイトルで上書きされない, so that 自分で指定したタイトルが保持される。

#### Acceptance Criteria

1. WHEN User_Title が設定されたブックマークに対して OGP_Fetcher がタイトルを取得した場合, THE OGP_Fetcher SHALL User_Title を保持し OGP タイトルで上書きしない
2. WHEN User_Title が空のブックマークに対して OGP_Fetcher がタイトルを取得した場合, THE OGP_Fetcher SHALL OGP タイトルをブックマークのタイトルとして設定する
3. WHILE User_Title が設定されている場合, THE OGP_Fetcher SHALL OGP タイトル以外のメタデータ（説明、画像 URL）は通常通り適用する

### Requirement 4: AI 補完時のタイトル優先制御

**User Story:** As a ユーザー, I want 手動入力したタイトルが AI 補完のタイトルで上書きされない, so that AI が提案するタイトルよりも自分の入力が優先される。

#### Acceptance Criteria

1. WHILE User_Title が設定されたブックマークに対して AI_Enricher が実行される場合, THE AI_Enricher SHALL suggestedTitle をブックマークのタイトルに適用しない
2. WHEN User_Title が空のブックマークに対して AI_Enricher が実行された場合, THE AI_Enricher SHALL suggestedTitle をブックマークのタイトルとして設定する
3. WHILE User_Title が設定されている場合, THE AI_Enricher SHALL タイトル以外の補完（タグ、メモ、説明、Collection 振り分け）は通常通り実行する

### Requirement 5: パイプライン実行の継続

**User Story:** As a ユーザー, I want タイトルを手動入力した場合でも OGP フェッチと AI 補完が実行される, so that タイトル以外のメタデータ（画像、タグ、メモ、説明）が自動補完される。

#### Acceptance Criteria

1. WHEN User_Title が設定されたブックマークが作成された場合, THE OGP_Fetcher SHALL OGP メタデータの取得を実行する
2. WHEN User_Title が設定されたブックマークの OGP 取得が完了した場合, THE AI_Enricher SHALL AI 補完処理を実行する
3. IF OGP_Fetcher が失敗した場合, THEN THE AI_Enricher SHALL OGP タイトルなしで AI 補完処理を実行する

### Requirement 6: フォーム操作性

**User Story:** As a ユーザー, I want QuickAdd の操作感が従来と同等に維持される, so that タイトル欄追加によって登録の手軽さが損なわれない。

#### Acceptance Criteria

1. THE QuickAdd SHALL URL 入力欄にフォーカスが当たった状態で初期表示する
2. WHEN ユーザーが Enter キーを押した場合, THE QuickAdd SHALL フォームを送信する
3. WHEN 登録処理中の場合, THE QuickAdd SHALL URL 入力欄とタイトル入力欄の両方を無効化する
4. THE QuickAdd SHALL タイトル入力欄の前後の空白文字をトリムしてから保存する
