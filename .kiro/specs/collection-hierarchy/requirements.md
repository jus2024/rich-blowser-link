# Requirements: Collection 階層構造対応

## Introduction

現在フラット構造の Collection を最大3段の階層（親・子・孫）に対応させる。
あわせて Bookmark の Collection 所属を「多対多」から「1対1（必ずどこか1つに属する）」に変更し、
ブラウザブックマークインポート時にフォルダ階層を維持して取り込めるようにする。

## Glossary

- **Collection**: Bookmark をグループ化するフォルダ的な分類単位
- **parentId**: 親 Collection の ID。ルートレベルの Collection は null
- **階層深さ**: ルートを1段目として最大3段まで（ルート → 子 → 孫）
- **未分類**: どの Collection にも属さない Bookmark。システムが自動的に管理する概念
- **collectionId**: Bookmark が直接属する Collection の ID（1対1）

## Requirements

### Requirement 1: Collection の階層構造

**User Story:** As a ユーザー, I want Collection をフォルダのように階層化したい, so that ブラウザのブックマークと同じ感覚で整理できる。

#### Acceptance Criteria

1.1 THE System SHALL support a maximum of 3 levels of Collection hierarchy (root → child → grandchild).

1.2 THE System SHALL add a `parentId` field (nullable string) to the Collection model in the Amplify Data schema.

1.3 WHEN a Collection has `parentId` set to null, THE System SHALL treat it as a root-level Collection.

1.4 WHEN creating a Collection, THE System SHALL allow specifying a `parentId` to place it under a parent Collection.

1.5 THE System SHALL prevent creating a Collection at depth 4 or deeper (i.e., a child of a grandchild Collection).

1.6 THE System SHALL display Collections in the sidebar as an indented tree structure reflecting the hierarchy.

1.7 WHEN a parent Collection is deleted, THE System SHALL also delete all descendant Collections and their Bookmark associations.

### Requirement 2: Bookmark の Collection 所属を1対1に変更

**User Story:** As a ユーザー, I want 各ブックマークが必ず1つの Collection に属するようにしたい, so that 整理状況が明確になる。

#### Acceptance Criteria

2.1 THE System SHALL add a `collectionId` field (nullable string, default null) to the Bookmark model.

2.2 WHEN a Bookmark has `collectionId` set to null, THE System SHALL treat it as "未分類".

2.3 WHEN a user assigns a Bookmark to a Collection via the assign dialog, THE System SHALL update the `collectionId` field of the Bookmark (replacing any previous assignment).

2.4 THE System SHALL remove the BookmarkCollection many-to-many join table from active use (kept in schema for backward compatibility but no longer used for new assignments).

2.5 THE System SHALL filter Bookmarks by Collection using the `collectionId` field on the Bookmark model.

2.6 THE System SHALL display the count of Bookmarks per Collection based on the `collectionId` field.

### Requirement 3: インポート時の階層維持

**User Story:** As a ユーザー, I want ブラウザのブックマークをインポートする際にフォルダ階層を維持したい, so that インポート後もフォルダ構造が再現される。

#### Acceptance Criteria

3.1 WHEN importing a browser bookmark file, THE System SHALL create Collections reflecting the folder hierarchy up to 3 levels deep.

3.2 WHEN a folder path exceeds 3 levels, THE System SHALL truncate to the first 3 levels and place the Bookmark in the 3rd-level Collection.

3.3 THE System SHALL set the `collectionId` field on each imported Bookmark to the ID of the corresponding Collection.

3.4 WHEN a Collection with the same name already exists at the same parent level, THE System SHALL reuse the existing Collection rather than creating a duplicate.

3.5 WHEN a Bookmark has no folder path (root level), THE System SHALL leave `collectionId` as null (未分類).

### Requirement 4: サイドバーのツリー表示

**User Story:** As a ユーザー, I want サイドバーで Collection の階層をツリー表示したい, so that どの階層にいるか視覚的に分かる。

#### Acceptance Criteria

4.1 THE System SHALL render root Collections at the top level of the sidebar list.

4.2 THE System SHALL render child Collections indented under their parent, with visual indentation per level.

4.3 THE System SHALL allow collapsing and expanding parent Collections in the sidebar.

4.4 WHEN a Collection is selected, THE System SHALL show only Bookmarks with `collectionId` matching that Collection (not including descendants).

4.5 THE System SHALL display the Bookmark count next to each Collection name.
