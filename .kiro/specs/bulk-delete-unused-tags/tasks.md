# Implementation Plan: Bulk Delete Unused Tags

## Overview

既存の useTags フックに `deleteUnusedTags` メソッドを追加し、TagFilter コンポーネントに一括削除ボタンと `window.confirm` による確認ダイアログを実装する。page.tsx で両者を接続する。

## Tasks

- [ ] 1. useTags フックに deleteUnusedTags メソッドを追加
  - [ ] 1.1 Implement `deleteUnusedTags` method in useTags hook
    - `src/hooks/useTags.ts` の `UseTagsReturn` インターフェースに `deleteUnusedTags: () => Promise<void>` を追加
    - `tags` から `bookmarkCount === 0` のタグをフィルタし、逐次 `deleteTag(id)` を呼び出す実装を追加
    - エラー発生時は即座に throw して呼び出し元に伝播
    - フックの返り値に `deleteUnusedTags` を含める
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 1.2 Write property test for deleteUnusedTags
    - **Property 3: deleteUnusedTags removes exactly the unused tags**
    - 任意の TagWithCount[] に対して、`bookmarkCount === 0` のタグのみが `deleteTag` で呼ばれることを検証
    - **Validates: Requirements 3.1, 3.2**

- [ ] 2. TagFilter コンポーネントに一括削除 UI を追加
  - [ ] 2.1 Extend TagFilter props and add BulkDeleteButton
    - `src/components/tag/TagFilter.tsx` の `TagFilterProps` に `onDeleteUnusedTags?: () => Promise<void>` と `unusedTagCount?: number` を追加
    - Tags ヘッダー内に一括削除ボタンを配置（`onDeleteUnusedTags` 未提供時は非表示）
    - `unusedTagCount === 0` または削除中の場合は disabled 状態にする
    - `aria-label="未使用タグを一括削除"` でアクセシビリティを確保
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

  - [ ] 2.2 Implement confirmation dialog and delete handler
    - `handleBulkDelete` 関数を実装: `window.confirm` で確認 → `onDeleteUnusedTags()` を呼び出し
    - 確認メッセージは `${unusedTagCount}件の未使用タグを削除しますか？` 形式
    - `isDeleting` state で削除中の状態管理（ボタン disabled + テキスト変更）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2_

  - [ ] 2.3 Add CSS styles for BulkDeleteButton
    - `src/components/tag/TagFilter.module.css` に `.bulkDeleteButton` スタイルを追加
    - 既存の `.clearButton` に準じたスタイル（hover 時に赤色、disabled 時に opacity 低下）
    - _Requirements: 1.1_

  - [ ]* 2.4 Write unit tests for TagFilter bulk delete UI
    - ボタンの表示/非表示（prop 有無）、disabled 状態（unusedTagCount === 0）、削除中の状態を検証
    - **Property 1: Button disabled state reflects unused tag count**
    - **Property 4: Button visibility controlled by prop presence**
    - **Validates: Requirements 1.3, 1.4, 5.3**

- [ ] 3. page.tsx で useTags と TagFilter を接続
  - [ ] 3.1 Wire deleteUnusedTags and unusedTagCount in page.tsx
    - `src/app/page.tsx` で `useTags()` から `deleteUnusedTags` を取得
    - `useMemo` で `tags` から `unusedTagCount` を算出
    - TagFilter に `onDeleteUnusedTags={deleteUnusedTags}` と `unusedTagCount={unusedTagCount}` を渡す
    - _Requirements: 3.4, 5.1, 5.2_

- [ ] 4. Checkpoint - 型チェックと動作確認
  - Ensure all tests pass, ask the user if questions arise.
  - `tsc --noEmit` で型エラーがないことを確認
  - lint エラーがないことを確認

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `window.confirm` を使用するため、新しいライブラリやモーダルコンポーネントは不要
- 逐次削除（for...of + await）で安定性を確保。部分削除状態は許容する設計
- 既存の `deleteTag` ロジック（BookmarkTag カスケード削除含む）をそのまま再利用

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "1.2"] },
    { "id": 3, "tasks": ["3.1", "2.4"] }
  ]
}
```
