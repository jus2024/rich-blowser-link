# Requirements Document

## Introduction

Bookmark Agent にブックマークデータへのアクセス・検索ツールを追加する。現在の `bookmark_agent` は基本的な全文検索（`search_bookmarks`）のみ実装されているが、タグ・コレクション・ステータスによるフィルタリング、個別ブックマークの詳細取得、一覧取得といった機能が不足している。本機能により、エージェントがユーザーのブックマークデータを多角的に検索・参照できるようになる。

## Glossary

- **Bookmark_Agent**: `agents/bookmark_agent/` に配置された Strands エージェント。AgentCore Runtime 上で動作し、ユーザーのブックマーク関連の質問に回答する
- **Bookmark_Tools**: Bookmark_Agent が使用する `@tool` デコレータ付きの Python 関数群。DynamoDB からブックマークデータを取得する
- **DynamoDB_Client**: boto3 を使用して DynamoDB テーブルにアクセスするクライアント。IAM 認証で接続する
- **Owner_ID**: Cognito ユーザー ID（sub クレーム）。DynamoDB の `owner` フィールドと照合してデータ分離を実現する
- **Bookmark_Table**: Amplify Data が管理する DynamoDB テーブル。Bookmark モデルのデータを格納する
- **Tag_Table**: Tag モデルのデータを格納する DynamoDB テーブル
- **BookmarkTag_Table**: Bookmark と Tag の多対多関係を格納する中間テーブル
- **Collection_Table**: Collection モデルのデータを格納する DynamoDB テーブル
- **BookmarkCollection_Table**: Bookmark と Collection の多対多関係を格納する中間テーブル
- **AgentCore_Runtime**: Amazon Bedrock AgentCore Runtime。エージェントの実行基盤であり、JWT 認証によりユーザー識別情報を提供する

## Requirements

### Requirement 1: ブックマークのキーワード検索

**User Story:** As a user, I want to search my bookmarks by keyword, so that I can quickly find bookmarks related to a topic.

#### Acceptance Criteria

1. WHEN a search query is provided, THE Bookmark_Tools SHALL query the Bookmark_Table and return bookmarks where the query matches the title, url, description, or memo fields
2. WHEN a search query is provided with an owner_id, THE Bookmark_Tools SHALL return only bookmarks where the `owner` field matches the provided Owner_ID
3. WHEN no bookmarks match the search query, THE Bookmark_Tools SHALL return an empty list
4. WHEN the search query contains multiple keywords, THE Bookmark_Tools SHALL match bookmarks containing any of the keywords and rank results by relevance (number of keyword matches)
5. IF a DynamoDB access error occurs during search, THEN THE Bookmark_Tools SHALL return a user-friendly error message describing the failure

### Requirement 2: ブックマーク一覧の取得

**User Story:** As a user, I want to list my bookmarks with optional filters, so that I can browse my bookmark collection by category.

#### Acceptance Criteria

1. WHEN a list request is made with an owner_id, THE Bookmark_Tools SHALL return all bookmarks belonging to the specified Owner_ID
2. WHERE a status filter is specified, THE Bookmark_Tools SHALL return only bookmarks matching the specified status value (inbox, read, or archived)
3. WHERE a collection name filter is specified, THE Bookmark_Tools SHALL return only bookmarks associated with the specified collection via the BookmarkCollection_Table
4. WHERE a tag name filter is specified, THE Bookmark_Tools SHALL return only bookmarks associated with the specified tag via the BookmarkTag_Table
5. WHEN the result set exceeds a configurable limit, THE Bookmark_Tools SHALL return at most the configured maximum number of items and indicate that more results exist
6. IF a DynamoDB access error occurs during listing, THEN THE Bookmark_Tools SHALL return a user-friendly error message describing the failure

### Requirement 3: 個別ブックマークの詳細取得

**User Story:** As a user, I want to get full details of a specific bookmark, so that I can see all metadata including memo, tags, and collections.

#### Acceptance Criteria

1. WHEN a bookmark ID and owner_id are provided, THE Bookmark_Tools SHALL retrieve the complete bookmark record from the Bookmark_Table
2. WHEN a bookmark ID and owner_id are provided, THE Bookmark_Tools SHALL also retrieve associated tag names from the Tag_Table via the BookmarkTag_Table
3. WHEN a bookmark ID and owner_id are provided, THE Bookmark_Tools SHALL also retrieve associated collection names from the Collection_Table via the BookmarkCollection_Table
4. WHEN the specified bookmark does not exist, THE Bookmark_Tools SHALL return a message indicating the bookmark was not found
5. WHEN the specified bookmark exists but belongs to a different owner, THE Bookmark_Tools SHALL return a message indicating the bookmark was not found (without revealing its existence)
6. IF a DynamoDB access error occurs during retrieval, THEN THE Bookmark_Tools SHALL return a user-friendly error message describing the failure

### Requirement 4: オーナーベースのデータ分離

**User Story:** As a user, I want my bookmark data to be isolated from other users, so that my data remains private and secure.

#### Acceptance Criteria

1. THE Bookmark_Tools SHALL include an `owner` field filter condition in every DynamoDB query to enforce data isolation
2. THE Bookmark_Tools SHALL accept the Owner_ID as a parameter in every tool function
3. WHEN a tool function is called without an owner_id, THE Bookmark_Tools SHALL return an error indicating that owner identification is required
4. THE Bookmark_Tools SHALL use exact match comparison (not partial match) for the owner field filtering

### Requirement 5: DynamoDB テーブル名の設定

**User Story:** As a developer, I want DynamoDB table names to be configurable via environment variables, so that the agent works across different deployment environments (sandbox, develop, production).

#### Acceptance Criteria

1. THE Bookmark_Tools SHALL read DynamoDB table names from environment variables: `BOOKMARK_TABLE_NAME`, `TAG_TABLE_NAME`, `BOOKMARKTAG_TABLE_NAME`, `COLLECTION_TABLE_NAME`, `BOOKMARKCOLLECTION_TABLE_NAME`
2. IF a required table name environment variable is not set, THEN THE Bookmark_Tools SHALL raise a configuration error at initialization time with a descriptive message identifying the missing variable
3. THE Bookmark_Tools SHALL use the configured AWS region from the common config module for DynamoDB client initialization

### Requirement 6: エラーハンドリングとユーザーフレンドリーなレスポンス

**User Story:** As a user, I want the agent to handle errors gracefully, so that I receive helpful messages instead of cryptic error traces.

#### Acceptance Criteria

1. IF a DynamoDB `ClientError` occurs, THEN THE Bookmark_Tools SHALL log the full error details and return a simplified error message to the user
2. IF a network timeout occurs when accessing DynamoDB, THEN THE Bookmark_Tools SHALL return a message indicating a temporary service issue
3. THE Bookmark_Tools SHALL return results in a structured format containing bookmark title, url, and relevant metadata fields
4. WHEN returning search or list results, THE Bookmark_Tools SHALL include the total count of matching items in the response

### Requirement 7: タグ一覧とコレクション一覧の取得

**User Story:** As a user, I want to ask the agent what tags and collections I have, so that I can use them as filters when searching bookmarks.

#### Acceptance Criteria

1. WHEN a tag list request is made with an owner_id, THE Bookmark_Tools SHALL return all tags belonging to the specified Owner_ID from the Tag_Table
2. WHEN a collection list request is made with an owner_id, THE Bookmark_Tools SHALL return all collections belonging to the specified Owner_ID from the Collection_Table
3. WHEN returning tags, THE Bookmark_Tools SHALL include the tag name and ID
4. WHEN returning collections, THE Bookmark_Tools SHALL include the collection name, description, and ID
5. IF a DynamoDB access error occurs, THEN THE Bookmark_Tools SHALL return a user-friendly error message describing the failure
