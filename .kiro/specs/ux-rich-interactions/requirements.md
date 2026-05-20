# Requirements Document

## Introduction

ブックマーク管理アプリケーション「Rich Browser Link」に対し、UX を向上させるリッチインタラクション機能群を追加する。具体的には、(1) 読み物系ブックマークへのステータス導線改善、(2) ドラッグ&ドロップによるコレクション割り当てと並び替え、(3) カードホバーでの OGP プレビュー表示、(4) 最近アクセスしたブックマークのハイライト、(5) ブックマークのピン留め機能の 5 つの機能を実装する。

## Glossary

- **System**: Rich Browser Link アプリケーション全体
- **BookmarkCard**: ブックマーク情報を表示する UI コンポーネント
- **StatusSelector**: ブックマークのステータス（後で読む/アーカイブ）を変更する UI コンポーネント
- **OGPPreviewCard**: OGP 画像・説明をポップオーバー表示するプレビューコンポーネント
- **CollectionSidebar**: コレクション一覧を表示するサイドバー領域
- **BookmarkList**: ブックマーク一覧を表示するリスト表示コンポーネント
- **DragOverlay**: ドラッグ中に表示されるオーバーレイ要素
- **isReadable**: Bookmark モデルに追加する boolean フィールド。ユーザーが手動で「読み物系」と指定したことを示す
- **sortOrder**: Bookmark モデルに追加する number フィールド。リスト内の並び順を示す
- **pinned**: Bookmark モデルに追加する boolean フィールド。ピン留め状態を示す
- **lastAccessedAt**: Bookmark モデルの既存フィールド。最終アクセス日時を ISO 8601 形式で保持する

## Requirements

### Requirement 1: 読み物系ブックマークのステータス導線改善

**User Story:** As a ユーザー, I want 読み物系のブックマークにだけステータスセレクターを表示したい, so that 全ブックマークにステータス操作が表示される煩雑さを解消できる。

#### Acceptance Criteria

1.1 THE System SHALL provide an `isReadable` boolean field on the Bookmark model with a default value of `false`.

1.2 WHEN a user toggles the "読み物系" option on a BookmarkCard, THE System SHALL update the `isReadable` field of the corresponding Bookmark to `true` or `false`.

1.3 WHILE a Bookmark has `isReadable` set to `true`, THE System SHALL display the StatusSelector on the corresponding BookmarkCard.

1.4 WHILE a Bookmark has `isReadable` set to `false`, THE System SHALL hide the StatusSelector on the corresponding BookmarkCard.

1.5 WHEN the `isReadable` field is updated, THE System SHALL persist the change to the DynamoDB backend via Amplify Data.

1.6 THE System SHALL display the "読み物系" toggle control in the BookmarkCard action area.

### Requirement 2: ドラッグ&ドロップによるコレクション割り当て

**User Story:** As a ユーザー, I want ブックマークをサイドバーのコレクションにドラッグして割り当てたい, so that マウス操作だけで素早くブックマークを整理できる。

#### Acceptance Criteria

2.1 THE System SHALL implement drag-and-drop functionality using the `@dnd-kit/core` library.

2.2 WHEN a user starts dragging a BookmarkCard, THE System SHALL display a DragOverlay representing the dragged Bookmark.

2.3 WHEN a user drops a BookmarkCard onto a collection item in the CollectionSidebar, THE System SHALL create a BookmarkCollection association between the dropped Bookmark and the target Collection.

2.4 WHILE a BookmarkCard is being dragged over a valid drop target in the CollectionSidebar, THE System SHALL apply a visual highlight to the drop target.

2.5 IF a Bookmark is already associated with the target Collection, THEN THE System SHALL display a notification indicating the duplicate assignment and cancel the operation.

2.6 WHEN a drag operation is cancelled by releasing outside a valid drop target, THE System SHALL return the BookmarkCard to its original position without modifying data.

### Requirement 3: ドラッグ&ドロップによるリスト並び替え

**User Story:** As a ユーザー, I want リスト表示モードでブックマークの並び順をドラッグで変更したい, so that 自分の好みの順序でブックマークを管理できる。

#### Acceptance Criteria

3.1 THE System SHALL provide a `sortOrder` number field on the Bookmark model with a default value of `0`.

3.2 WHILE the display mode is "list", THE System SHALL enable drag-and-drop reordering of BookmarkCard items.

3.3 WHEN a user drops a BookmarkCard at a new position in the list, THE System SHALL update the `sortOrder` field of affected Bookmarks to reflect the new order.

3.4 WHEN `sortOrder` values are updated, THE System SHALL persist the changes to the DynamoDB backend via Amplify Data.

3.5 WHILE the display mode is "grid" or "compact", THE System SHALL disable drag-and-drop reordering.

3.6 WHEN the list is rendered, THE System SHALL sort Bookmarks by `sortOrder` in ascending order as the default sort when no other sort key is active.

### Requirement 4: カードホバーでの OGP プレビュー表示

**User Story:** As a ユーザー, I want ブックマークカードにホバーしたときに OGP プレビューを確認したい, so that リンク先の内容をクリックせずに把握できる。

#### Acceptance Criteria

4.1 WHEN a user hovers over a BookmarkCard for 200 milliseconds or longer, THE System SHALL display the OGPPreviewCard as a popover near the hovered card.

4.2 WHEN a user moves the pointer away from the BookmarkCard, THE System SHALL hide the OGPPreviewCard.

4.3 THE System SHALL reuse the existing OGPPreviewCard component for the popover content.

4.4 WHILE the OGPPreviewCard is displayed, THE System SHALL show the OGP image and description of the corresponding Bookmark.

4.5 IF the Bookmark has no OGP image, THEN THE System SHALL display a placeholder image in the OGPPreviewCard.

4.6 THE System SHALL position the OGPPreviewCard so that the popover does not overflow the viewport boundaries.

### Requirement 5: 最近アクセスしたブックマークのハイライト

**User Story:** As a ユーザー, I want 最近アクセスしたブックマークを視覚的に区別したい, so that 直近で使ったブックマークをすぐに見つけられる。

#### Acceptance Criteria

5.1 WHILE a Bookmark has a `lastAccessedAt` value within the past 24 hours from the current time, THE System SHALL apply a visual highlight to the corresponding BookmarkCard.

5.2 THE System SHALL render the visual highlight as a colored left border on the BookmarkCard.

5.3 WHILE a Bookmark has a `lastAccessedAt` value older than 24 hours or an empty value, THE System SHALL render the BookmarkCard without the highlight.

5.4 WHEN the bookmark list is rendered, THE System SHALL evaluate the 24-hour threshold based on the client-side current time.

### Requirement 6: ブックマークのピン留め機能

**User Story:** As a ユーザー, I want 重要なブックマークをピン留めしてリスト上部に固定表示したい, so that よく使うブックマークに素早くアクセスできる。

#### Acceptance Criteria

6.1 THE System SHALL provide a `pinned` boolean field on the Bookmark model with a default value of `false`.

6.2 WHEN a user activates the pin action on a BookmarkCard, THE System SHALL update the `pinned` field of the corresponding Bookmark to `true`.

6.3 WHEN a user activates the unpin action on a BookmarkCard, THE System SHALL update the `pinned` field of the corresponding Bookmark to `false`.

6.4 WHEN the bookmark list is rendered, THE System SHALL display all Bookmarks with `pinned` set to `true` above all Bookmarks with `pinned` set to `false`.

6.5 WHEN the `pinned` field is updated, THE System SHALL persist the change to the DynamoDB backend via Amplify Data.

6.6 THE System SHALL display a pin icon or badge on BookmarkCards that have `pinned` set to `true`.

6.7 THE System SHALL provide the pin/unpin action in the BookmarkCard action menu.

### Requirement 7: データモデル変更

**User Story:** As a 開発者, I want Bookmark モデルに新しいフィールドを追加したい, so that ステータス導線改善・並び替え・ピン留め機能のデータを永続化できる。

#### Acceptance Criteria

7.1 THE System SHALL add an `isReadable` field of type boolean with a default value of `false` to the Bookmark model in the Amplify Data schema.

7.2 THE System SHALL add a `sortOrder` field of type integer with a default value of `0` to the Bookmark model in the Amplify Data schema.

7.3 THE System SHALL add a `pinned` field of type boolean with a default value of `false` to the Bookmark model in the Amplify Data schema.

7.4 THE System SHALL maintain backward compatibility with existing Bookmark records that lack the new fields by treating missing values as their respective defaults.

7.5 THE System SHALL update the TypeScript `Bookmark` interface in `src/types/index.ts` to include the `isReadable`, `sortOrder`, and `pinned` fields.
