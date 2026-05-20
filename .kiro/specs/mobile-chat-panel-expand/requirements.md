# Requirements Document

## Introduction

モバイルビュー（768px以下）において、右側のAIチャットパネル（AgentChatSection）をフルスクリーンオーバーレイとして展開可能にする機能。既存の左サイドバー（MobileSidebarOverlay）と同じUIパターンを採用し、ヘッダー右側にチャットアイコンボタンを配置してトリガーとする。左サイドバーとチャットパネルは排他的に動作し、一方を開くと他方が自動的に閉じる。

## Glossary

- **Mobile_Chat_Overlay**: モバイルビューでチャットパネルをフルスクリーンオーバーレイとして表示するコンポーネント
- **Chat_Toggle_Button**: ヘッダー右側に配置されるチャットパネル展開用のアイコンボタン
- **Mobile_Sidebar_Overlay**: 既存の左サイドバーをモバイルでフルスクリーンオーバーレイとして表示するコンポーネント
- **Header**: ページ上部のヘッダー領域（タイトル、ハンバーガーメニュー、アクションボタンを含む）
- **AgentChatSection**: AgentCore Runtime との SSE 通信による AI チャット機能を提供するコンポーネント
- **Mobile_View**: 画面幅が768px以下の状態

## Requirements

### Requirement 1: チャットトグルボタンの表示

**User Story:** As a モバイルユーザー, I want ヘッダーにチャットパネルを開くボタンが表示される, so that チャット機能にアクセスできる

#### Acceptance Criteria

1. WHILE Mobile_View である, THE Header SHALL Chat_Toggle_Button をハンバーガーメニューと対称の右側位置に表示する
2. THE Chat_Toggle_Button SHALL チャットを示すアイコン（吹き出しアイコン）を表示する
3. THE Chat_Toggle_Button SHALL アクセシビリティ用の aria-label 属性を持つ
4. WHILE Mobile_View でない, THE Header SHALL Chat_Toggle_Button を非表示にする

### Requirement 2: チャットオーバーレイの展開

**User Story:** As a モバイルユーザー, I want チャットボタンをタップしてチャットパネルをフルスクリーンで開きたい, so that モバイルでもAIチャットを快適に利用できる

#### Acceptance Criteria

1. WHEN Chat_Toggle_Button がタップされる, THE Mobile_Chat_Overlay SHALL フルスクリーンオーバーレイとして表示される
2. THE Mobile_Chat_Overlay SHALL 背景にバックドロップ（半透明の暗い背景）を表示する
3. THE Mobile_Chat_Overlay SHALL AgentChatSection コンポーネントをコンテンツとして含む
4. THE Mobile_Chat_Overlay SHALL 画面右側からスライドインするパネルとして表示される
5. THE Mobile_Chat_Overlay SHALL パネル幅を画面幅の100%（フルスクリーン）に設定する

### Requirement 3: チャットオーバーレイの閉じる操作

**User Story:** As a モバイルユーザー, I want チャットパネルを閉じてメインコンテンツに戻りたい, so that ブックマーク操作を再開できる

#### Acceptance Criteria

1. WHEN バックドロップがタップされる, THE Mobile_Chat_Overlay SHALL 閉じる
2. THE Mobile_Chat_Overlay SHALL 閉じるボタンをパネル内に表示する
3. WHEN 閉じるボタンがタップされる, THE Mobile_Chat_Overlay SHALL 閉じる

### Requirement 4: 左サイドバーとの排他制御

**User Story:** As a モバイルユーザー, I want 左サイドバーとチャットパネルが同時に開かないようにしたい, so that 画面が重複して操作しにくくならない

#### Acceptance Criteria

1. WHEN Chat_Toggle_Button がタップされる AND Mobile_Sidebar_Overlay が開いている, THE Mobile_Sidebar_Overlay SHALL 閉じる
2. WHEN ハンバーガーメニューがタップされる AND Mobile_Chat_Overlay が開いている, THE Mobile_Chat_Overlay SHALL 閉じる
3. WHILE Mobile_Chat_Overlay が開いている, THE Header SHALL ハンバーガーメニューボタンを操作可能な状態で維持する

### Requirement 5: デスクトップ表示との整合性

**User Story:** As a ユーザー, I want デスクトップとモバイルで一貫したチャット体験を得たい, so that デバイスを切り替えても混乱しない

#### Acceptance Criteria

1. WHILE Mobile_View でない, THE AgentChatSection SHALL 既存の ResizableSidebar 内に表示される（現行動作を維持）
2. WHILE Mobile_View である, THE ResizableSidebar 内の AgentChatSection SHALL 非表示のままとする（現行動作を維持）
3. WHILE Mobile_View である, THE AgentChatSection SHALL Mobile_Chat_Overlay 経由でのみアクセス可能とする

### Requirement 6: オーバーレイのアクセシビリティ

**User Story:** As a スクリーンリーダー利用者, I want チャットオーバーレイが適切にアナウンスされる, so that 支援技術でもチャット機能を利用できる

#### Acceptance Criteria

1. THE Mobile_Chat_Overlay SHALL 適切な ARIA ロール属性を持つ
2. THE Mobile_Chat_Overlay SHALL aria-label でパネルの目的を示す
3. WHEN Mobile_Chat_Overlay が開かれる, THE バックドロップ SHALL aria-hidden 属性を持つ
