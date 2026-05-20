# Implementation Plan: mobile-responsive

## Overview

既存の3カラムレイアウト（左サイドバー + メインコンテンツ + 右チャットパネル）をモバイルデバイス（768px以下）で最適化する。`useMediaQuery` カスタムフックによるモバイル判定、ハンバーガーメニュー経由のサイドバーオーバーレイ、右パネル非表示、表示モード固定を実装する。

## Tasks

- [x] 1. useMediaQuery フックの作成
  - [x] 1.1 `src/hooks/useMediaQuery.ts` を新規作成する
    - `window.matchMedia` API を使用してメディアクエリの一致状態をリアクティブに返すカスタムフックを実装する
    - SSR 対応として `typeof window === "undefined"` チェックで初期値 `false` を返す
    - `useEffect` 内で `change` イベントリスナーを登録し、クリーンアップで解除する
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.2 useMediaQuery フックのユニットテストを作成する
    - **Property 1: useMediaQuery は matchMedia の結果と一致する**
    - **Validates: Requirements 1.1, 1.2**
    - `window.matchMedia` のモックを使用してフックの動作を検証する
    - リスナー登録・解除の確認

- [x] 2. MobileSidebarOverlay コンポーネントの作成
  - [x] 2.1 `src/components/layout/MobileSidebarOverlay.tsx` と `src/components/layout/MobileSidebarOverlay.module.css` を新規作成する
    - `isOpen`, `onClose`, `children` を props として受け取るコンポーネントを実装する
    - `isOpen` が `false` の場合は `null` を返す
    - 半透明 Backdrop（クリックで `onClose` 呼び出し）と固定位置パネルを描画する
    - パネルは `width: 280px; max-width: 80vw` で左端に固定表示する
    - z-index はメインコンテンツ・ヘッダーより高く設定する（backdrop: 40, panel: 50）
    - アクセシビリティ: `role="navigation"`, `aria-label` を設定する
    - _Requirements: 3.2, 3.3, 3.4, 3.7_

  - [ ]* 2.2 MobileSidebarOverlay のユニットテストを作成する
    - `isOpen=true` 時にパネルと Backdrop が描画されることを確認
    - Backdrop クリックで `onClose` が呼ばれることを確認
    - `isOpen=false` 時に何も描画されないことを確認
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 3. Checkpoint - フック・コンポーネント単体の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. page.tsx にモバイルレスポンシブロジックを統合する
  - [x] 4.1 `src/app/page.tsx` に `useMediaQuery` フックを導入し、モバイル判定とレイアウト制御ロジックを追加する
    - `useMediaQuery("(max-width: 768px)")` でモバイル判定を行う
    - `isMobileMenuOpen` state を追加する
    - モバイル時に右サイドバー（`isChatCollapsed`）を強制的に `true` にし、デスクトップ復帰時に `useRef` で保持した前回値を復元する
    - モバイル時に左サイドバー（`isSidebarCollapsed`）を `true` にする
    - `isMobileMenuOpen` と `isSidebarCollapsed` を同期する
    - 表示モードをモバイル時は `"list"` に固定する（`effectiveDisplayMode`）
    - _Requirements: 4.1, 4.2, 4.3, 5.2, 5.3_

  - [x] 4.2 ヘッダーにハンバーガーメニューボタンを追加する
    - モバイル時のみ表示するハンバーガーボタン（`☰`）をヘッダー左端に配置する
    - クリックで `setIsMobileMenuOpen(true)` を呼び出す
    - `aria-label="メニューを開く"` を設定する
    - _Requirements: 2.2, 2.4_

  - [x] 4.3 `MobileSidebarOverlay` をレイアウトに組み込む
    - `isMobileMenuOpen` と `onClose` を渡してオーバーレイを描画する
    - オーバーレイ内に左サイドバーの内容（CollectionList, TagFilter, StatusFilter）を配置する
    - モバイル時は `ResizableSidebar`（左）を非表示にし、オーバーレイ経由でのみアクセス可能にする
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 4.4 モバイル時に右サイドバー（ResizableSidebar side="right"）を非表示にする
    - モバイル時は右サイドバーの `ResizableSidebar` コンポーネントを条件付きレンダリングで除外する
    - _Requirements: 4.1, 4.2_

  - [x] 4.5 表示モード切り替え（BookmarkToolbar）のモバイル対応
    - `BookmarkToolbar` に渡す `displayMode` を `effectiveDisplayMode` に変更する
    - ブックマーク一覧の条件分岐も `effectiveDisplayMode` を使用する
    - _Requirements: 5.1, 5.2_

- [x] 5. CSS のモバイル対応を拡張する
  - [x] 5.1 `src/app/page.module.css` にモバイル用スタイルを追加・更新する
    - ハンバーガーボタンのスタイル（デフォルト `display: none`、モバイル時 `display: flex`）
    - モバイル時のヘッダーパディング（`0.5rem 0.75rem`）
    - モバイル時のタイトルフォントサイズ（`1rem`）
    - モバイル時の `displayModeSwitcher` 非表示
    - モバイル時のコンテンツエリア: `width: 100%`, `padding: 0.75rem`, `max-height: none`, `overflow-y: visible`
    - _Requirements: 2.1, 2.3, 5.1, 6.2, 7.1, 7.2, 7.3_

- [x] 6. Checkpoint - 統合確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 型チェックと lint の確認
  - [x] 7.1 `npx tsc --noEmit` と `npx next lint` を実行して型エラー・lint エラーがないことを確認する
    - 全ファイルの型整合性を検証する
    - _Requirements: 全体_

  - [ ]* 7.2 モバイルレスポンシブ統合テストを作成する
    - **Property 2: ハンバーガーメニューの表示はモバイル状態と一致する**
    - **Property 3: モバイル時に左サイドバーはデフォルトレイアウトから除外される**
    - **Property 5: モバイル時に右サイドバーは非表示かつ isChatCollapsed が true**
    - **Property 6: モバイル時の表示モードは常に "list"**
    - **Validates: Requirements 2.2, 2.4, 3.1, 4.1, 4.2, 5.1, 5.2**
    - ビューポートサイズを変更した際のレイアウト切り替えを検証する

- [x] 8. Final checkpoint - 最終確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- 既存の `page.module.css` には一部モバイル対応スタイルが存在するため、上書き・拡張する形で対応する
- `useMediaQuery` フックは汎用的に設計し、他の機能でも再利用可能にする

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "5.1"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["7.2"] }
  ]
}
```
