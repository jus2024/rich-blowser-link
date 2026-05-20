# Requirements Document

## Introduction

ブックマーク新規作成・編集フォームを、現在のインライン表示からモーダルダイアログ表示に変更する。既存の `BookmarkForm` コンポーネントは変更せず、新しい `BookmarkFormDialog` ラッパーコンポーネントを作成し、`ImportDialog` と同じ overlay + card パターンでラップする。

## Glossary

- **BookmarkFormDialog**: BookmarkForm をモーダルダイアログとして表示するラッパーコンポーネント
- **BookmarkForm**: 既存のブックマーク作成・編集フォームコンポーネント
- **Overlay**: ダイアログ背面に表示される半透明の背景レイヤー
- **Card**: Overlay 上に配置されるダイアログ本体のコンテナ要素
- **Page**: トップページ（`src/app/page.tsx`）

## Requirements

### Requirement 1: ダイアログコンポーネントの作成

**User Story:** As a 開発者, I want BookmarkForm をダイアログとして表示するラッパーコンポーネントを使いたい, so that 既存の BookmarkForm を変更せずにモーダル表示を実現できる

#### Acceptance Criteria

1. THE BookmarkFormDialog SHALL overlay + card パターンで BookmarkForm をラップして表示する
2. WHEN BookmarkFormDialog が表示されるとき, THE BookmarkFormDialog SHALL 固定位置の Overlay を画面全体に描画する
3. THE BookmarkFormDialog の Card SHALL `max-width: 720px` で中央配置される
4. THE BookmarkFormDialog SHALL `role="dialog"` および `aria-modal="true"` 属性を Card 要素に付与する
5. THE BookmarkFormDialog SHALL CSS Modules を使用してスタイルを定義する
6. THE BookmarkFormDialog SHALL プロジェクトの CSS 変数（`--color-surface`, `--color-border`, `--radius` 等）を使用する

### Requirement 2: ダイアログの開閉制御

**User Story:** As a ユーザー, I want ダイアログを安全に閉じたい, so that 入力中のデータを誤って失わない

#### Acceptance Criteria

1. WHEN ユーザーが ESC キーを押したとき, THE BookmarkFormDialog SHALL ダイアログを閉じる
2. WHEN ユーザーが Overlay をクリックしたとき, THE BookmarkFormDialog SHALL ダイアログを閉じずに表示を維持する
3. WHEN `isOpen` プロパティが `false` のとき, THE BookmarkFormDialog SHALL 何も描画しない
4. WHEN BookmarkForm の `onCancel` が呼び出されたとき, THE BookmarkFormDialog SHALL ダイアログを閉じる
5. WHEN BookmarkForm の `onSubmit` が正常完了したとき, THE BookmarkFormDialog SHALL ダイアログを閉じる

### Requirement 3: Page コンポーネントとの統合

**User Story:** As a ユーザー, I want 新規作成ボタンや編集操作でダイアログが開いてほしい, so that フォーム入力に集中できる

#### Acceptance Criteria

1. WHEN ユーザーが「+ 新規作成」ボタンをクリックしたとき, THE Page SHALL BookmarkFormDialog を新規作成モードで表示する
2. WHEN ユーザーがブックマークの編集操作を行ったとき, THE Page SHALL BookmarkFormDialog を編集モードで表示する
3. THE Page SHALL 既存の `isFormVisible` / `editingBookmark` state を使用して BookmarkFormDialog の開閉を制御する
4. THE Page SHALL インラインの BookmarkForm 表示を BookmarkFormDialog に置き換える

### Requirement 4: 既存コンポーネントの非破壊

**User Story:** As a 開発者, I want 既存の BookmarkForm コンポーネントに変更を加えたくない, so that 他の利用箇所への影響を防げる

#### Acceptance Criteria

1. THE BookmarkFormDialog SHALL BookmarkForm の既存 Props（`bookmark`, `onSubmit`, `onCancel`, `initialTags`）をそのまま透過的に渡す
2. THE BookmarkForm コンポーネントのソースコード SHALL 変更されない状態を維持する

### Requirement 5: アクセシビリティ

**User Story:** As a スクリーンリーダー利用者, I want ダイアログが適切にアナウンスされてほしい, so that フォームの文脈を理解できる

#### Acceptance Criteria

1. THE BookmarkFormDialog SHALL ダイアログに適切な `aria-label` を付与する
2. WHEN BookmarkFormDialog が表示されたとき, THE BookmarkFormDialog SHALL フォーカスをダイアログ内部に移動する
3. THE BookmarkFormDialog の Overlay SHALL `z-index: 1000` 以上で他のコンテンツの上に表示される
