# Requirements Document

## Introduction

モバイルデバイス（768px以下）でのレスポンシブ対応を実装する。クイック入力バーとリスト表示を維持しつつ、左サイドバーをハンバーガーメニュー経由のオーバーレイ表示に変更し、右サイドバー（AIチャット）を非表示にする。ヘッダーはコンパクト化し、表示モード切り替えUIは非表示とする。

## Glossary

- **App**: Rich Browser Link Webアプリケーション全体
- **Mobile_View**: ビューポート幅が768px以下の表示状態
- **Desktop_View**: ビューポート幅が769px以上の表示状態
- **Left_Sidebar**: コレクション一覧・タグフィルタ・ステータスフィルタを含む左サイドバー
- **Right_Sidebar**: AIチャットセクションを含む右サイドバー
- **Hamburger_Menu**: 三本線アイコンのメニューボタン
- **Sidebar_Overlay**: モバイルで左サイドバーをオーバーレイ表示するパネル
- **Backdrop**: オーバーレイ背面の半透明背景レイヤー
- **Quick_Add**: URL入力バー（クイック入力コンポーネント）
- **Display_Mode_Switcher**: リスト/グリッド/コンパクト表示の切り替えUI
- **useMediaQuery_Hook**: ビューポート幅に基づくモバイル判定カスタムフック
- **isSidebarCollapsed**: 左サイドバーの開閉状態を管理する既存state

## Requirements

### Requirement 1: モバイル判定フック

**User Story:** As a 開発者, I want ビューポート幅に基づくモバイル判定を再利用可能なフックとして提供したい, so that モバイル固有のレイアウト制御を一元管理できる

#### Acceptance Criteria

1. THE useMediaQuery_Hook SHALL accept a CSS media query string as a parameter and return a boolean indicating whether the query matches
2. WHEN the viewport width changes across the 768px boundary, THE useMediaQuery_Hook SHALL update the returned boolean value to reflect the current match state
3. THE useMediaQuery_Hook SHALL use the window.matchMedia API for media query evaluation
4. WHEN the component using useMediaQuery_Hook unmounts, THE useMediaQuery_Hook SHALL remove the media query event listener

### Requirement 2: モバイルヘッダーのコンパクト化

**User Story:** As a モバイルユーザー, I want ヘッダーがコンパクトに表示されてほしい, so that 限られた画面領域を有効活用できる

#### Acceptance Criteria

1. WHILE Mobile_View is active, THE App SHALL reduce the header padding to 0.5rem vertically and 0.75rem horizontally
2. WHILE Mobile_View is active, THE App SHALL display the Hamburger_Menu button in the header
3. WHILE Mobile_View is active, THE App SHALL reduce the title font size to 1rem
4. WHILE Desktop_View is active, THE App SHALL hide the Hamburger_Menu button

### Requirement 3: 左サイドバーのオーバーレイ表示

**User Story:** As a モバイルユーザー, I want 左サイドバーをハンバーガーメニューから開きたい, so that 画面を広く使いながら必要なときだけナビゲーションにアクセスできる

#### Acceptance Criteria

1. WHILE Mobile_View is active, THE App SHALL hide the Left_Sidebar from the default layout
2. WHEN the user taps the Hamburger_Menu button in Mobile_View, THE App SHALL display the Sidebar_Overlay with the Left_Sidebar content as a fixed-position panel overlaying the main content
3. WHEN the Sidebar_Overlay is open, THE App SHALL display a semi-transparent Backdrop behind the Sidebar_Overlay
4. WHEN the user taps the Backdrop, THE App SHALL close the Sidebar_Overlay
5. WHILE the Sidebar_Overlay is open, THE App SHALL set isSidebarCollapsed to false
6. WHEN the Sidebar_Overlay closes, THE App SHALL set isSidebarCollapsed to true
7. THE Sidebar_Overlay SHALL have a z-index higher than the main content and header

### Requirement 4: 右サイドバーの非表示

**User Story:** As a モバイルユーザー, I want AIチャットパネルがモバイルで非表示になってほしい, so that メインコンテンツに画面全体を使える

#### Acceptance Criteria

1. WHILE Mobile_View is active, THE App SHALL hide the Right_Sidebar completely including its resize handle
2. WHILE Mobile_View is active, THE App SHALL set isChatCollapsed to true
3. WHILE Desktop_View is active, THE App SHALL restore the Right_Sidebar visibility based on the user's previous collapse state

### Requirement 5: 表示モード切り替えの非表示

**User Story:** As a モバイルユーザー, I want モバイルではリスト表示のみ使いたい, so that モバイルに最適化された一覧表示で閲覧できる

#### Acceptance Criteria

1. WHILE Mobile_View is active, THE App SHALL hide the Display_Mode_Switcher UI
2. WHILE Mobile_View is active, THE App SHALL force the display mode to "list" regardless of the stored preference
3. WHILE Desktop_View is active, THE App SHALL restore the Display_Mode_Switcher UI and the user's previously selected display mode

### Requirement 6: クイック入力バーの維持

**User Story:** As a モバイルユーザー, I want モバイルでもURL入力バーを使いたい, so that 素早くブックマークを追加できる

#### Acceptance Criteria

1. WHILE Mobile_View is active, THE App SHALL display the Quick_Add component in the main content area
2. WHILE Mobile_View is active, THE Quick_Add component SHALL occupy the full available width of the content area

### Requirement 7: メインコンテンツのモバイル最適化

**User Story:** As a モバイルユーザー, I want メインコンテンツが画面幅いっぱいに表示されてほしい, so that ブックマーク一覧を快適に閲覧できる

#### Acceptance Criteria

1. WHILE Mobile_View is active, THE App SHALL display the main content area at full viewport width
2. WHILE Mobile_View is active, THE App SHALL reduce the content padding to 0.75rem horizontally
3. WHILE Mobile_View is active, THE App SHALL remove the max-height constraint on the content area to allow natural scrolling
