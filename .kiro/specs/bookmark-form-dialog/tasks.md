# Implementation Plan: ブックマーク新規作成・編集フォームのダイアログ化

## Overview

既存の `BookmarkForm` コンポーネントを変更せずに、新しい `BookmarkFormDialog` ラッパーコンポーネントを作成し、`ImportDialog` と同じ overlay + card パターンでモーダルダイアログ表示を実現する。`page.tsx` のインライン表示を `BookmarkFormDialog` に置き換える。

## Tasks

- [ ] 1. BookmarkFormDialog コンポーネントの作成
  - [ ] 1.1 CSS Modules ファイルの作成
    - `src/components/bookmark/BookmarkFormDialog.module.css` を作成する
    - `.overlay`: `position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;`
    - `.card`: `max-width: 720px; background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius);`
    - ImportDialog.module.css の overlay + card パターンを踏襲する
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 5.3_

  - [ ] 1.2 BookmarkFormDialog コンポーネントの実装
    - `src/components/bookmark/BookmarkFormDialog.tsx` を作成する
    - `BookmarkFormDialogProps` インターフェースを定義（`isOpen`, `onClose`, `bookmark?`, `onSubmit`, `initialTags?`）
    - `isOpen === false` 時は `null` を返す
    - overlay + card 構造で `BookmarkForm` をラップして描画する
    - `role="dialog"`, `aria-modal="true"`, `aria-label` を card 要素に付与する
    - `BookmarkForm` の props（`bookmark`, `onSubmit`, `onCancel`, `initialTags`）を透過的に渡す
    - `onCancel` を `onClose` にマッピングする
    - `onSubmit` 成功後に `onClose` を呼び出すラッパーを実装する
    - _Requirements: 1.1, 1.4, 2.3, 2.4, 2.5, 4.1, 5.1_

  - [ ] 1.3 キーボード操作とフォーカス管理の実装
    - ESC キーのイベントリスナーを登録し、押下時に `onClose` を呼び出す
    - Overlay のクリックイベントは無視する（データ消失防止）
    - ダイアログ表示時に card 要素（`tabIndex={-1}`）にフォーカスを移動する
    - `isOpen` が `false` になったらイベントリスナーをクリーンアップする
    - _Requirements: 2.1, 2.2, 5.2_

- [ ] 2. Page コンポーネントとの統合
  - [ ] 2.1 page.tsx のインライン BookmarkForm を BookmarkFormDialog に置き換え
    - `BookmarkFormDialog` を import する
    - `isFormVisible && <BookmarkForm ...>` ブロックを `<BookmarkFormDialog isOpen={isFormVisible} onClose={handleFormCancel} ...>` に置き換える
    - 既存の `isFormVisible` / `editingBookmark` state をそのまま使用する
    - `handleFormSubmit` 内の `setIsFormVisible(false)` を削除する（ダイアログ側で `onClose` を呼ぶため）
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Checkpoint - lint・型チェックの実行
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 4. プロパティテストの作成
  - [ ]* 4.1 ダイアログ構造の整合性テスト
    - **Property 1: ダイアログ構造の整合性**
    - `isOpen=true` 時に overlay > card > BookmarkForm の構造が描画されることを検証する
    - **Validates: Requirements 1.1**

  - [ ]* 4.2 アクセシビリティ属性の完全性テスト
    - **Property 2: アクセシビリティ属性の完全性**
    - `isOpen=true` 時に card 要素が `role="dialog"`, `aria-modal="true"`, 非空の `aria-label` を持つことを検証する
    - **Validates: Requirements 1.4, 5.1**

  - [ ]* 4.3 ESC キーによるダイアログ閉じテスト
    - **Property 3: ESC キーによるダイアログ閉じ**
    - ダイアログ表示中に ESC キーイベントを発火すると `onClose` が1回呼ばれることを検証する
    - **Validates: Requirements 2.1**

  - [ ]* 4.4 Overlay クリックの無視テスト
    - **Property 4: Overlay クリックの無視**
    - ダイアログ表示中に overlay をクリックしても `onClose` が呼ばれないことを検証する
    - **Validates: Requirements 2.2**

  - [ ]* 4.5 非表示時の空レンダリングテスト
    - **Property 5: 非表示時の空レンダリング**
    - `isOpen=false` 時にコンポーネントが何も描画しないことを検証する
    - **Validates: Requirements 2.3**

  - [ ]* 4.6 Props の透過的転送テスト
    - **Property 6: Props の透過的転送**
    - `bookmark` と `initialTags` が内部の `BookmarkForm` にそのまま渡されることを検証する
    - **Validates: Requirements 4.1**

- [ ] 5. Final checkpoint - 全体の動作確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 既存の `BookmarkForm` コンポーネントは一切変更しない（Requirement 4.2）
- `handleFormSubmit` の変更は、ダイアログ側で閉じる制御を行うため `setIsFormVisible(false)` の重複呼び出しを除去する最小限の修正
- CSS 変数（`--color-surface`, `--color-border`, `--radius`）はプロジェクト既存のものを使用する
- Property tests validate universal correctness properties from the design document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] }
  ]
}
```
