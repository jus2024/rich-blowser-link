# Implementation Plan: quick-add-title-input

## Overview

QuickAdd コンポーネントにタイトル入力欄を追加し、ユーザーが URL 登録時にオプションでタイトルを指定できるようにする。ユーザーが入力したタイトルは OGP フェッチおよび AI 補完で取得されるタイトルよりも優先される。変更対象は主に 3 ファイル: `QuickAdd.tsx`, `QuickAdd.module.css`, `page.tsx`。

## Tasks

- [x] 1. QuickAdd コンポーネントの更新
  - [x] 1.1 QuickAddProps の onAdd シグネチャを変更し、タイトル入力欄を追加する
    - `onAdd` の型を `(url: string, title?: string) => Promise<void>` に変更
    - `title` state を追加し、タイトル入力フィールドを URL 入力の下に配置
    - `maxLength={200}`, `placeholder="タイトル（任意）"`, `disabled={isAdding}` を設定
    - `handleSubmit` でタイトルを trim し、空でなければ `onAdd(finalUrl, trimmedTitle)` を呼び出す
    - 送信成功時に URL とタイトルの両方をクリアする
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 1.2 QuickAdd.module.css にタイトル入力欄のスタイルを追加する
    - `.titleInput` クラスを追加（URL 入力と同様のスタイル、幅は全幅）
    - コンテナのレイアウトを調整してタイトル入力欄を収容する
    - _Requirements: 1.1_

  - [ ]* 1.3 QuickAdd コンポーネントのユニットテストを作成する
    - タイトル入力欄の存在とプレースホルダーの確認
    - タイトル入力 + URL 入力で送信時に onAdd が正しい引数で呼ばれることの確認
    - タイトル空で送信時に onAdd の第2引数が undefined であることの確認
    - 送信成功後に両フィールドがクリアされることの確認
    - 送信中に両フィールドが disabled になることの確認
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 6.3_

  - [ ]* 1.4 QuickAdd のプロパティテストを作成する
    - **Property 4: Title inclusion in bookmark creation**
    - **Property 5: Both fields cleared after successful submission**
    - **Property 6: Title max length enforcement**
    - **Validates: Requirements 1.4, 2.1, 2.2, 2.3, 6.4**

- [x] 2. page.tsx のパイプライン更新
  - [x] 2.1 handleQuickAdd を更新してタイトルを createBookmark に渡す
    - `handleQuickAdd` のシグネチャを `(url: string, title?: string)` に変更
    - `title` が存在する場合は `BookmarkInput` に `title` を含めて `createBookmark` に渡す
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 bookmarksRef を追加し、handleOGPItemComplete にタイトル優先制御を実装する
    - `bookmarksRef` を追加: `const bookmarksRef = useRef(bookmarks)` + `useEffect` で同期
    - `handleOGPItemComplete` 内で `bookmarksRef.current.find(b => b.id === result.bookmarkId)` を参照
    - 現在の bookmark の title が空でない場合は OGP title での上書きをスキップ
    - description, ogpImageUrl は従来通り適用する
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2_

  - [x] 2.3 applyEnrichmentResult にタイトル優先制御を実装する
    - `bookmarks.find(b => b.id === bookmarkId)` で現在の bookmark を参照
    - 現在の bookmark の title が空でない場合は `suggestedTitle` の適用をスキップ
    - description, memo, collection, tags は従来通り適用する
    - _Requirements: 4.1, 4.2, 4.3, 5.2, 5.3_

  - [ ]* 2.4 タイトル優先制御のプロパティテストを作成する
    - **Property 1: Title priority in OGP callback**
    - **Property 2: Title priority in AI enrichment callback**
    - **Property 3: Non-title metadata always applied**
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3**

- [x] 3. Checkpoint - 型チェックとテスト確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- バックエンド変更は不要（`BookmarkInput` 型に既に `title?: string` が存在）
- 変更対象ファイル: `src/components/bookmark/QuickAdd.tsx`, `src/components/bookmark/QuickAdd.module.css`, `src/app/page.tsx`
- プロパティテストには `fast-check` ライブラリを使用
- タイトル優先ロジックは純粋関数として抽出してテスト可能にすることを推奨

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4"] }
  ]
}
```
