# Requirements Document

## Introduction

左サイドバーの Tags セクションにおいて、Bookmark に一件も紐づいていない（bookmarkCount が 0 の）タグをまとめて一括削除する機能を追加する。ユーザーは Tags ヘッダーに常時表示されるボタンから操作を開始し、確認ダイアログで意思確認を行ったうえで削除を実行する。ロジックは既存の useTags フックに `deleteUnusedTags()` メソッドとして追加する。

## Glossary

- **TagFilter**: 左サイドバーの Tags セクション UI を担当するコンポーネント（`src/components/tag/TagFilter.tsx`）
- **useTags**: Tag の CRUD およびフィルタリングロジックを提供するカスタムフック（`src/hooks/useTags.ts`）
- **UnusedTag**: `bookmarkCount` が 0 であるタグ。Bookmark に一件も紐づいていない状態を指す
- **TagWithCount**: Tag エンティティに `bookmarkCount` フィールドを付加した型
- **BulkDeleteButton**: Tags ヘッダーに常時表示される一括削除トリガーボタン
- **ConfirmationDialog**: 削除実行前にユーザーの意思確認を行うダイアログ UI

## Requirements

### Requirement 1: 未使用タグ一括削除ボタンの表示

**User Story:** As a ユーザー, I want Tags ヘッダーに未使用タグの一括削除ボタンが常時表示されている, so that 不要なタグをまとめて整理する操作にすぐアクセスできる。

#### Acceptance Criteria

1. THE TagFilter SHALL display the BulkDeleteButton in the Tags header area alongside the existing title.
2. THE BulkDeleteButton SHALL be visible regardless of whether UnusedTags exist.
3. WHILE no UnusedTags exist, THE BulkDeleteButton SHALL be displayed in a disabled state.
4. WHILE one or more UnusedTags exist, THE BulkDeleteButton SHALL be displayed in an enabled state.
5. THE BulkDeleteButton SHALL include an accessible label that describes the bulk delete action.

### Requirement 2: 確認ダイアログの表示

**User Story:** As a ユーザー, I want 一括削除の実行前に確認ダイアログが表示される, so that 意図しない削除を防止できる。

#### Acceptance Criteria

1. WHEN the user activates the BulkDeleteButton, THE TagFilter SHALL display the ConfirmationDialog.
2. THE ConfirmationDialog SHALL display the count of UnusedTags to be deleted in the format「○件の未使用タグを削除しますか？」.
3. THE ConfirmationDialog SHALL provide a confirm action and a cancel action.
4. WHEN the user selects the cancel action, THE ConfirmationDialog SHALL close without performing any deletion.
5. THE ConfirmationDialog SHALL be accessible with appropriate ARIA roles and focus management.

### Requirement 3: 一括削除ロジックの実行

**User Story:** As a ユーザー, I want 確認後に未使用タグがすべて削除される, so that タグ一覧が整理された状態になる。

#### Acceptance Criteria

1. WHEN the user confirms the deletion in the ConfirmationDialog, THE useTags hook SHALL delete all UnusedTags.
2. THE useTags hook SHALL expose a `deleteUnusedTags` method that identifies and deletes all tags where `bookmarkCount` equals 0.
3. THE useTags hook SHALL delete each UnusedTag using the existing `deleteTag` logic, including BookmarkTag cascade deletion.
4. WHEN all UnusedTags are successfully deleted, THE TagFilter SHALL update the tag list to reflect the removal.
5. IF a deletion error occurs during bulk delete, THEN THE useTags hook SHALL report the error to the caller.

### Requirement 4: 削除中の状態表示

**User Story:** As a ユーザー, I want 削除処理中であることが視覚的にわかる, so that 処理が進行中であることを認識でき、重複操作を避けられる。

#### Acceptance Criteria

1. WHILE the bulk deletion is in progress, THE BulkDeleteButton SHALL be displayed in a disabled state to prevent duplicate invocations.
2. WHILE the bulk deletion is in progress, THE TagFilter SHALL indicate the processing state to the user.
3. WHEN the bulk deletion completes, THE BulkDeleteButton SHALL return to its normal enabled or disabled state based on the remaining UnusedTag count.

### Requirement 5: Props インターフェースの拡張

**User Story:** As a 開発者, I want TagFilter コンポーネントが一括削除のハンドラを props で受け取る, so that ロジックと UI の分離が維持される。

#### Acceptance Criteria

1. THE TagFilter SHALL accept an optional `onDeleteUnusedTags` prop of type `() => Promise<void>`.
2. THE TagFilter SHALL accept an optional `unusedTagCount` prop of type `number` to determine the BulkDeleteButton state and dialog message.
3. WHEN `onDeleteUnusedTags` prop is not provided, THE TagFilter SHALL hide the BulkDeleteButton.
