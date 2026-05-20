# Implementation Plan: Mobile Chat Panel Expand

## Overview

モバイルビュー（768px以下）で AI チャットパネルをフルスクリーンオーバーレイとして展開する機能を実装する。新規コンポーネント `MobileChatOverlay` を作成し、`page.tsx` に状態管理と排他制御を追加する。既存コンポーネント（MobileSidebarOverlay, AgentChatSection, ResizableSidebar）は変更しない。

## Tasks

- [ ] 1. MobileChatOverlay コンポーネントの作成
  - [ ] 1.1 MobileChatOverlay.module.css を作成する
    - `src/components/layout/MobileChatOverlay.module.css` を作成
    - `.backdrop`: `position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); z-index: 40`
    - `.panel`: `position: fixed; top: 0; right: 0; bottom: 0; width: 100%; z-index: 50; display: flex; flex-direction: column`
    - `.closeButton`: パネル内左上の閉じるボタンスタイル
    - `.content`: `flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column`
    - _Requirements: 2.2, 2.4, 2.5_

  - [ ] 1.2 MobileChatOverlay.tsx コンポーネントを実装する
    - `src/components/layout/MobileChatOverlay.tsx` を作成
    - Props: `isOpen: boolean`, `onClose: () => void`, `children: React.ReactNode`
    - `isOpen` が false の場合は null を返す（MobileSidebarOverlay と同じパターン）
    - backdrop クリックで `onClose` を呼び出す
    - 閉じるボタン（✕）をパネル内左上に配置し、クリックで `onClose` を呼び出す
    - ARIA 属性: panel に `role="dialog"` と `aria-label="AI チャット"`、backdrop に `aria-hidden="true"`
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 6.1, 6.2, 6.3_

  - [ ]* 1.3 MobileChatOverlay の Property テストを作成する
    - **Property 2: 閉じるアクションはオーバーレイを閉じる**
    - **Validates: Requirements 3.1, 3.3**

- [ ] 2. page.tsx にチャットトグルボタンと状態管理を追加する
  - [ ] 2.1 isMobileChatOpen state と排他制御ロジックを追加する
    - `const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)` を追加
    - ハンバーガーメニュー onClick に `setIsMobileChatOpen(false)` を追加（排他制御）
    - _Requirements: 4.1, 4.2_

  - [ ] 2.2 ヘッダーにチャットトグルボタンを追加する
    - `isMobile && (...)` 条件でヘッダー右側（headerActions の前）にボタンを配置
    - ボタン onClick: `setIsMobileChatOpen(true); setIsMobileMenuOpen(false)`（排他制御）
    - `aria-label="チャットを開く"` を付与
    - アイコン: 💬（吹き出し絵文字）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_

  - [ ] 2.3 MobileChatOverlay を layout div 内に配置する
    - MobileSidebarOverlay の直後に MobileChatOverlay を配置
    - `isOpen={isMobileChatOpen}` と `onClose={() => setIsMobileChatOpen(false)}` を渡す
    - children に `<AgentChatSection runtimeArn={RUNTIME_ARN} />` を渡す
    - _Requirements: 2.1, 2.3, 5.2, 5.3_

  - [ ]* 2.4 排他制御の Property テストを作成する
    - **Property 3: 排他制御 — 同時に開けるオーバーレイは最大1つ**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 3. page.module.css にチャットトグルボタンのスタイルを追加する
  - [ ] 3.1 chatToggleButton スタイルを追加する
    - `page.module.css` に `.chatToggleButton` クラスを追加
    - デフォルト: `display: none`
    - `@media (max-width: 768px)`: `display: flex; align-items: center; justify-content: center`
    - _Requirements: 1.1, 1.4_

  - [ ]* 3.2 チャットトグルボタン表示条件の Property テストを作成する
    - **Property 1: チャットトグルボタンの表示はモバイル状態に依存する**
    - **Validates: Requirements 1.1, 1.4**

- [ ] 4. Checkpoint - 型チェックと lint の確認
  - Ensure all tests pass, ask the user if questions arise.
  - `npx tsc --noEmit` で TypeScript コンパイルエラーがないことを確認
  - `npx next lint` で lint エラーがないことを確認

- [ ] 5. 統合確認
  - [ ] 5.1 デスクトップ表示との整合性を確認するテストを作成する
    - AgentChatSection が `!isMobile` 条件で ResizableSidebar 内に表示されることを確認
    - モバイル時は ResizableSidebar 内の AgentChatSection が非表示であることを確認
    - _Requirements: 5.1, 5.2_

  - [ ]* 5.2 モバイルビューでの AgentChatSection アクセス経路の Property テストを作成する
    - **Property 4: モバイルビューでの AgentChatSection アクセス経路**
    - **Validates: Requirements 5.2, 5.3**

- [ ] 6. Final checkpoint - 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- 既存コンポーネント（MobileSidebarOverlay, AgentChatSection, ResizableSidebar）は変更不要
- TypeScript + CSS Modules のパターンは既存の MobileSidebarOverlay を踏襲する

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "3.2"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
