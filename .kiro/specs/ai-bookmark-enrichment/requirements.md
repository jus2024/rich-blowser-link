# Requirements Document

## Introduction

AI Bookmark Enrichment は、ブックマーク新規登録時に Amazon Bedrock を利用して、メモ（要約）・タグ候補・タイトル補完・説明補完を自動生成する機能である。OGP 取得後にバックグラウンドで軽量に実行し、ユーザーの手動入力を削減する。既存の OGP 取得フロー（`/api/ogp`）の後段に位置し、Next.js API Route から Amazon Bedrock を直接呼び出す構成とする。

## Glossary

- **Enrichment_API**: `/api/ai-enrich` エンドポイント。URL と OGP 情報を受け取り、AI による補完情報を JSON で返す Next.js API Route
- **Bedrock_Client**: Amazon Bedrock の InvokeModel API を呼び出すクライアントモジュール
- **Enrichment_Result**: Enrichment_API が返す補完情報オブジェクト（タグ候補、メモ、タイトル補完、説明補完を含む）
- **QuickAdd_Component**: URL を入力して即座にブックマークを登録する既存の UI コンポーネント
- **OGP_Data**: `/api/ogp` から取得される title, description, imageUrl の情報
- **Bookmark_Record**: Amplify Data の Bookmark モデルレコード
- **AI_Toggle**: AI 補完機能のオン/オフを切り替える UI トグルスイッチ
- **AI_Enabled_State**: AI 補完が有効かどうかを示す boolean 状態（localStorage に永続化）

## Requirements

### Requirement 1: AI 補完 API エンドポイント

**User Story:** As a developer, I want a dedicated API endpoint for AI enrichment, so that the frontend can request AI-generated metadata for bookmarks.

#### Acceptance Criteria

1. WHEN a POST request with a valid URL and OGP_Data is received, THE Enrichment_API SHALL return an Enrichment_Result containing suggestedTags, suggestedMemo, suggestedTitle, and suggestedDescription fields
2. WHEN a POST request is missing the url field, THE Enrichment_API SHALL return HTTP 400 with an error message
3. WHEN the url field is not a valid URL format, THE Enrichment_API SHALL return HTTP 400 with an error message
4. IF the Bedrock_Client call fails or times out, THEN THE Enrichment_API SHALL return HTTP 200 with empty enrichment fields rather than an error response
5. THE Enrichment_API SHALL respond within 10 seconds for any request
6. THE Enrichment_API SHALL return suggestedTags as an array of strings with a maximum of 5 tags
7. THE Enrichment_API SHALL return suggestedMemo as a string with a maximum length of 300 characters
8. THE Enrichment_API SHALL return suggestedTitle as a string with a maximum length of 200 characters
9. THE Enrichment_API SHALL return suggestedDescription as a string with a maximum length of 500 characters

### Requirement 2: OGP 欠落時のタイトル・説明補完

**User Story:** As a user, I want AI to fill in the title and description when OGP data is unavailable, so that my bookmarks always have meaningful metadata.

#### Acceptance Criteria

1. WHEN OGP_Data contains an empty title, THE Enrichment_API SHALL generate a suggestedTitle based on the URL and available page content
2. WHEN OGP_Data contains an empty description, THE Enrichment_API SHALL generate a suggestedDescription based on the URL and available page content
3. WHEN OGP_Data already contains a non-empty title, THE Enrichment_API SHALL return an empty suggestedTitle string
4. WHEN OGP_Data already contains a non-empty description, THE Enrichment_API SHALL return an empty suggestedDescription string

### Requirement 3: タグ自動生成

**User Story:** As a user, I want AI to suggest relevant tags for my bookmarks, so that I can organize them without manual tagging effort.

#### Acceptance Criteria

1. WHEN a valid URL and OGP_Data are provided, THE Enrichment_API SHALL generate between 1 and 5 suggestedTags based on the page content and metadata
2. THE Enrichment_API SHALL generate tags in Japanese when the page content is primarily in Japanese
3. THE Enrichment_API SHALL generate tags in English when the page content is primarily in English
4. THE Enrichment_API SHALL generate each tag as a single word or short phrase with a maximum length of 30 characters

### Requirement 4: メモ（要約）自動生成

**User Story:** As a user, I want AI to generate a brief summary memo for my bookmarks, so that I can quickly recall what each link is about.

#### Acceptance Criteria

1. WHEN a valid URL and OGP_Data are provided, THE Enrichment_API SHALL generate a suggestedMemo summarizing the page content in 1-2 sentences
2. THE Enrichment_API SHALL generate the memo in the same language as the page content
3. THE Enrichment_API SHALL focus the memo on the main topic or purpose of the page

### Requirement 5: バックグラウンド実行フロー

**User Story:** As a user, I want AI enrichment to happen in the background after bookmark creation, so that the registration process remains fast and responsive.

#### Acceptance Criteria

1. WHEN a new bookmark is created via QuickAdd_Component, THE system SHALL first complete the bookmark creation, then trigger OGP fetch, then trigger AI enrichment sequentially in the background
2. WHILE AI enrichment is in progress, THE QuickAdd_Component SHALL remain interactive and allow additional URL registrations
3. WHEN the Enrichment_Result is received, THE system SHALL update the Bookmark_Record with the suggested values for empty fields only
4. IF the AI enrichment request fails, THEN THE system SHALL log the error and leave the Bookmark_Record unchanged
5. THE system SHALL apply suggestedTags by creating Tag records and BookmarkTag associations automatically
6. WHEN suggestedTitle is non-empty and the Bookmark_Record title is empty, THE system SHALL update the Bookmark_Record title with suggestedTitle
7. WHEN suggestedDescription is non-empty and the Bookmark_Record description is empty, THE system SHALL update the Bookmark_Record description with suggestedDescription
8. WHEN suggestedMemo is non-empty and the Bookmark_Record memo is empty, THE system SHALL update the Bookmark_Record memo with suggestedMemo

### Requirement 6: Bedrock 呼び出し設定

**User Story:** As a developer, I want the Bedrock integration to be configurable and resilient, so that the system works reliably across environments.

#### Acceptance Criteria

1. THE Bedrock_Client SHALL use the model ID specified in the environment variable `BEDROCK_MODEL_ID`
2. THE Bedrock_Client SHALL use the AWS region specified in the environment variable `BEDROCK_REGION`
3. IF the environment variable `BEDROCK_MODEL_ID` is not set, THEN THE Enrichment_API SHALL return HTTP 200 with empty enrichment fields
4. THE Bedrock_Client SHALL set a request timeout of 8 seconds for each InvokeModel call
5. THE Bedrock_Client SHALL use IAM credentials from the execution environment without hardcoding credentials

### Requirement 7: プロンプト設計

**User Story:** As a developer, I want a well-structured prompt for the AI model, so that the enrichment results are consistent and useful.

#### Acceptance Criteria

1. THE Enrichment_API SHALL construct a prompt that includes the bookmark URL, OGP title, and OGP description as context
2. THE Enrichment_API SHALL instruct the model to return a JSON object with tags, memo, title, and description fields
3. THE Enrichment_API SHALL parse the model response as JSON and validate the structure before returning
4. IF the model response is not valid JSON or does not match the expected structure, THEN THE Enrichment_API SHALL return empty enrichment fields

### Requirement 8: レスポンス JSON パース

**User Story:** As a developer, I want robust parsing of the AI model's response, so that malformed responses do not break the application.

#### Acceptance Criteria

1. WHEN the model returns a valid JSON response matching the expected schema, THE Enrichment_API SHALL extract and return the enrichment fields
2. IF the model response contains extra fields beyond the expected schema, THEN THE Enrichment_API SHALL ignore the extra fields
3. IF the model response is missing required fields, THEN THE Enrichment_API SHALL use empty defaults for missing fields
4. FOR ALL valid Enrichment_Result objects, serializing to JSON then parsing back SHALL produce an equivalent object (round-trip property)

### Requirement 9: AI 補完のオン/オフトグル

**User Story:** As a ユーザー, I want AI 補完機能を画面上部のトグルで簡単にオン/オフ切り替えたい, so that 必要に応じて AI 補完を無効化できる

#### Acceptance Criteria

1. THE App SHALL display an AI_Toggle in the header area, positioned near the existing action buttons
2. WHEN the AI_Toggle is OFF, THE system SHALL skip the AI enrichment step entirely after OGP fetch
3. WHEN the AI_Toggle is ON, THE system SHALL execute the AI enrichment step as specified in Requirement 5
4. THE AI_Toggle state SHALL be persisted in localStorage so that the user's preference is retained across page reloads
5. THE AI_Toggle SHALL default to ON when no stored preference exists
6. THE AI_Toggle SHALL display a clear visual indicator of the current state (e.g., "AI 補完: ON" / "AI 補完: OFF")
7. WHEN the AI_Toggle state changes, THE system SHALL apply the new state immediately to subsequent bookmark registrations without requiring a page reload
