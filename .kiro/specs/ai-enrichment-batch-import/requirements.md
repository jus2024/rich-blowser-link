# Requirements Document

## Introduction

AI Enrichment Batch Import は、既存の AI Bookmark Enrichment 機能を拡張し、インポート時の大量ブックマークに対して AI 補完を全件適用可能にする機能である。現在の実装では `triggerAIEnrichment` が前回のリクエストを abort してから新しいリクエストを発行するため、インポート時に大量のブックマークが入ると最後の1件だけ AI 補完が適用される問題がある。本機能ではキュー方式のバッチ処理に変更し、全件に AI 補完を適用する。

また、インポート時の Collection 引き継ぎについて、従来の「フォルダ構成を必ず Collection として引き継ぐ」動作に加え、「フラットに取り込む」オプションを追加する。フラット取り込み時は AI が既存 Collection から適切なものを選んで振り分ける。

## Glossary

- **Enrichment_Queue**: AI 補完リクエストをキューイングし、順次またはコンカレンシー制御付きで処理するモジュール
- **Enrichment_API**: `/api/ai-enrich` エンドポイント。URL と OGP 情報を受け取り、AI による補完情報を JSON で返す Next.js API Route
- **Enrichment_Result**: Enrichment_API が返す補完情報オブジェクト（タグ候補、メモ、タイトル補完、説明補完、suggestedCollection を含む）
- **Batch_AI_Enrichment**: 複数のブックマークに対して AI 補完を順次実行するバッチ処理の仕組み
- **Import_Collection_Mode**: インポート時の Collection 取り扱いモード。「フォルダ構成を引き継ぐ」または「フラットに取り込む」のいずれか
- **Folder_Inherit_Mode**: Import_Collection_Mode の一つ。インポート元のフォルダ構成を Collection として再現し、各ブックマークに collectionId を設定するモード
- **Flat_Import_Mode**: Import_Collection_Mode の一つ。Collection を作成せず全てフラットに取り込み、AI が既存 Collection から適切なものを選んで設定するモード
- **Bookmark_Record**: Amplify Data の Bookmark モデルレコード
- **Collection_Record**: Amplify Data の Collection モデルレコード
- **OGP_Data**: `/api/ogp` から取得される title, description, imageUrl の情報
- **AI_Toggle**: AI 補完機能のオン/オフを切り替える UI トグルスイッチ
- **Concurrency_Limit**: Enrichment_Queue が同時に処理する AI 補完リクエストの最大数

## Requirements

### Requirement 1: AI 補完バッチ処理キュー

**User Story:** As a ユーザー, I want インポートした全てのブックマークに AI 補完が適用されるようにしたい, so that 大量インポート時にも全件の AI メタデータが自動生成される

#### Acceptance Criteria

1. WHEN multiple bookmarks require AI enrichment, THE Enrichment_Queue SHALL queue all requests and process them sequentially or with controlled concurrency, without aborting previous requests
2. THE Enrichment_Queue SHALL process queued items with a Concurrency_Limit of at most 3 simultaneous requests to avoid overloading the Enrichment_API
3. WHEN a new bookmark is added via QuickAdd while the Enrichment_Queue is processing, THE Enrichment_Queue SHALL append the new request to the end of the queue
4. WHILE the Enrichment_Queue is processing, THE system SHALL remain interactive and allow the user to perform other operations
5. IF an individual AI enrichment request in the queue fails, THEN THE Enrichment_Queue SHALL log the error, skip that item, and continue processing the remaining items
6. WHEN all items in the Enrichment_Queue have been processed, THE Enrichment_Queue SHALL emit a completion signal indicating the total processed count and failure count

### Requirement 2: インポート後の全件 AI 補完実行

**User Story:** As a ユーザー, I want インポート完了後に全ブックマークの AI 補完がバックグラウンドで実行されるようにしたい, so that インポートしたブックマーク全件にメモ・タグ・タイトル・説明が自動付与される

#### Acceptance Criteria

1. WHEN an import operation completes and AI_Toggle is ON, THE system SHALL enqueue all imported bookmarks that have completed OGP fetch into the Enrichment_Queue for AI enrichment
2. WHEN OGP fetch completes for an imported bookmark, THE system SHALL immediately enqueue that bookmark into the Enrichment_Queue rather than triggering a single non-queued AI enrichment call
3. WHILE the Enrichment_Queue is processing imported bookmarks, THE system SHALL update each Bookmark_Record with the Enrichment_Result as each item completes
4. IF the AI_Toggle is OFF at the time of import completion, THEN THE system SHALL skip AI enrichment for all imported bookmarks
5. WHEN the user navigates away from the page while the Enrichment_Queue is processing, THE system SHALL abort all pending requests in the queue gracefully

### Requirement 3: インポート時 Collection モード選択 UI

**User Story:** As a ユーザー, I want インポート時にフォルダ構成を引き継ぐかフラットに取り込むかを選択したい, so that 自分の整理方針に合わせてインポートできる

#### Acceptance Criteria

1. WHEN the import preview screen is displayed, THE ImportDialog SHALL present a radio button group for Import_Collection_Mode with two options: "フォルダ構成を引き継ぐ" and "フラットに取り込む"
2. THE ImportDialog SHALL default the Import_Collection_Mode selection to Folder_Inherit_Mode
3. WHEN Folder_Inherit_Mode is selected, THE ImportDialog SHALL display a preview of the folder structure that will be created as Collections
4. WHEN Flat_Import_Mode is selected, THE ImportDialog SHALL display a message indicating that all bookmarks will be imported without Collection assignment and AI will suggest Collections later
5. THE ImportDialog SHALL persist the selected Import_Collection_Mode and pass it to the startImport function

### Requirement 4: フォルダ構成引き継ぎモードの動作

**User Story:** As a ユーザー, I want フォルダ構成を引き継ぐモードでインポートした場合にフォルダ由来の Collection が優先されるようにしたい, so that インポート元の整理構造がそのまま反映される

#### Acceptance Criteria

1. WHEN Import_Collection_Mode is Folder_Inherit_Mode, THE system SHALL create Collection_Records from the folder structure and assign collectionId to each Bookmark_Record as in the current implementation
2. WHEN a Bookmark_Record already has a collectionId set by Folder_Inherit_Mode, THE system SHALL ignore the suggestedCollection field from the Enrichment_Result for that bookmark
3. WHEN Import_Collection_Mode is Folder_Inherit_Mode, THE system SHALL still apply suggestedTags, suggestedMemo, suggestedTitle, and suggestedDescription from the Enrichment_Result to the Bookmark_Record

### Requirement 5: フラットインポートモードの動作

**User Story:** As a ユーザー, I want フラットに取り込むモードでインポートした場合に AI が既存 Collection に振り分けてくれるようにしたい, so that 手動で Collection を整理する手間が省ける

#### Acceptance Criteria

1. WHEN Import_Collection_Mode is Flat_Import_Mode, THE system SHALL skip Collection creation from folder structure and set collectionId to null for all imported Bookmark_Records
2. WHEN Import_Collection_Mode is Flat_Import_Mode and AI_Toggle is ON, THE Enrichment_Queue SHALL process each imported bookmark and apply the suggestedCollection from the Enrichment_Result
3. WHEN the Enrichment_Result contains a suggestedCollection that matches an existing Collection_Record name, THE system SHALL set the Bookmark_Record collectionId to that Collection_Record id
4. WHEN the Enrichment_Result contains a suggestedCollection that does not match any existing Collection_Record name, THE system SHALL leave the Bookmark_Record collectionId as null
5. WHEN Import_Collection_Mode is Flat_Import_Mode and AI_Toggle is OFF, THE system SHALL leave all imported Bookmark_Records with collectionId as null

### Requirement 6: AI 補完バッチ処理の進捗表示

**User Story:** As a ユーザー, I want AI 補完のバッチ処理の進捗が分かるようにしたい, so that 処理がどの程度完了しているか把握できる

#### Acceptance Criteria

1. WHILE the Enrichment_Queue is processing items, THE system SHALL display a progress indicator showing the number of completed items out of the total queued items
2. THE progress indicator SHALL be displayed in a non-intrusive manner that does not block user interaction with the main interface
3. WHEN all items in the Enrichment_Queue have been processed, THE system SHALL hide the progress indicator after a brief delay of 3 seconds
4. WHEN an item in the Enrichment_Queue fails, THE progress indicator SHALL still increment the completed count and continue showing progress

### Requirement 7: 既存 QuickAdd フローとの互換性

**User Story:** As a ユーザー, I want 単件登録時の AI 補完が従来通り動作するようにしたい, so that 既存の使い勝手が損なわれない

#### Acceptance Criteria

1. WHEN a single bookmark is created via QuickAdd and OGP fetch completes, THE system SHALL enqueue the bookmark into the Enrichment_Queue for AI enrichment
2. WHEN the Enrichment_Queue contains only one item, THE system SHALL process it with the same latency characteristics as the previous single-request implementation
3. THE system SHALL apply the suggestedCollection from the Enrichment_Result to the Bookmark_Record when the Bookmark_Record has no collectionId set, maintaining the existing behavior for non-import bookmarks
