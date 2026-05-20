# Implementation Plan: AI Bookmark Enrichment

## Overview

AI Bookmark Enrichment を実装する。Amazon Bedrock を利用してブックマーク登録時にメモ・タグ候補・タイトル補完・説明補完を自動生成する。実装は以下の順序で進める: 型定義 → 純粋関数（パーサー、プロンプトビルダー、マージャー） → Bedrock クライアント → API Route → フロントエンド統合（トグル + バックグラウンド実行）。

## Tasks

- [x] 1. 型定義とプロジェクト構造のセットアップ
  - [x] 1.1 AI enrichment 用の型定義と定数を作成する
    - `src/lib/ai/types.ts` を作成し、`EnrichmentRequest`, `EnrichmentResult`, `PromptContext`, `BedrockClientConfig` インターフェースを定義する
    - `EMPTY_ENRICHMENT` 定数（空デフォルト値）を定義する
    - フィールド制約の定数（`MAX_TAGS: 5`, `MAX_TAG_LENGTH: 30`, `MAX_MEMO_LENGTH: 300`, `MAX_TITLE_LENGTH: 200`, `MAX_DESCRIPTION_LENGTH: 500`）を定義する
    - _Requirements: 1.6, 1.7, 1.8, 1.9_

- [x] 2. レスポンスパーサーの実装
  - [x] 2.1 `src/lib/ai/responseParser.ts` を実装する
    - `parseEnrichmentResponse(raw: string): EnrichmentResult` 関数を実装する
    - JSON パース失敗時は `EMPTY_ENRICHMENT` を返す
    - スキーマバリデーション（期待するフィールドの存在確認）を行う
    - フィールド制約の適用（文字数制限でトランケート、タグ数制限で切り詰め）
    - 余分なフィールドの無視、欠落フィールドへのデフォルト値適用
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 2.2 Property 1 のプロパティテストを書く
    - **Property 1: レスポンスパーサーはフィールド制約を常に満たす**
    - 任意の文字列入力に対して、返される EnrichmentResult が制約を満たすことを検証する
    - fast-check で任意文字列を生成し、`parseEnrichmentResponse` の出力が常に制約内であることを確認する
    - **Validates: Requirements 1.6, 1.7, 1.8, 1.9, 3.1, 3.4**

  - [ ]* 2.3 Property 5 のプロパティテストを書く
    - **Property 5: レスポンスパーサーは任意の文字列から有効な EnrichmentResult を生成する**
    - 任意の文字列入力（valid JSON, invalid JSON, partial JSON, empty string）に対して、常に構造的に有効な EnrichmentResult を返し例外を投げないことを検証する
    - **Validates: Requirements 7.3, 7.4, 8.1, 8.2, 8.3**

  - [ ]* 2.4 Property 6 のプロパティテストを書く
    - **Property 6: EnrichmentResult の JSON ラウンドトリップ**
    - 任意の有効な EnrichmentResult オブジェクトを JSON シリアライズし、`parseEnrichmentResponse` でパースした結果が元と等価であることを検証する
    - **Validates: Requirements 8.4**

- [x] 3. プロンプトビルダーの実装
  - [x] 3.1 `src/lib/ai/promptBuilder.ts` を実装する
    - `buildEnrichmentPrompt(context: PromptContext): string` 関数を実装する
    - URL、OGP タイトル、OGP 説明をプロンプトに埋め込む
    - JSON 形式での応答を指示する
    - OGP タイトルが空の場合はタイトル生成を指示、非空の場合は空文字を返すよう指示する
    - OGP 説明が空の場合は説明生成を指示、非空の場合は空文字を返すよう指示する
    - タグは1〜5個・各30文字以内、メモは1〜2文・300文字以内を指示する
    - ページの言語に合わせた出力を指示する
    - _Requirements: 7.1, 7.2, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

  - [ ]* 3.2 Property 7 のプロパティテストを書く
    - **Property 7: プロンプトは常に URL と OGP 情報を含む**
    - 任意の有効な URL と OGP データ（空文字列含む）に対して、構築されたプロンプトが URL 文字列、OGP タイトル値、OGP 説明値を含むことを検証する
    - **Validates: Requirements 7.1**

  - [ ]* 3.3 Property 4 のプロパティテストを書く
    - **Property 4: OGP 非空フィールドは補完されない**
    - プロンプトビルダーが OGP タイトルが非空の場合にタイトル生成をスキップする指示を含み、OGP 説明が非空の場合に説明生成をスキップする指示を含むことを検証する
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. Enrichment マージャーの実装
  - [x] 4.1 `src/lib/ai/enrichmentMerger.ts` を実装する
    - `mergeEnrichment(bookmark: Partial<Bookmark>, enrichment: EnrichmentResult): Partial<Bookmark>` 関数を実装する
    - Bookmark の空フィールドのみを EnrichmentResult の値で更新する
    - 非空フィールドは変更しない
    - _Requirements: 5.3, 5.6, 5.7, 5.8_

  - [ ]* 4.2 Property 8 のプロパティテストを書く
    - **Property 8: 空フィールドのみ更新される**
    - 任意の Bookmark レコード（一部フィールドが埋まっている）と任意の EnrichmentResult に対して、マージロジックが空フィールドのみ更新し、非空フィールドを変更しないことを検証する
    - **Validates: Requirements 5.3, 5.6, 5.7, 5.8**

- [x] 5. Checkpoint - 純粋関数の実装確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Bedrock クライアントの実装
  - [x] 6.1 `src/lib/ai/bedrockClient.ts` を実装する
    - `@aws-sdk/client-bedrock-runtime` を使用して `BedrockRuntimeClient` を初期化する
    - `createBedrockClient(config: BedrockClientConfig)` 関数を実装する
    - `invokeModel(client, prompt): Promise<string>` 関数を実装する
    - `AbortSignal.timeout(8000)` によるタイムアウト制御を実装する
    - IAM 認証（実行環境のクレデンシャルを自動使用）
    - エラーハンドリング（全例外をキャッチして呼び出し元に伝播）
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [ ]* 6.2 Bedrock クライアントのユニットテストを書く
    - タイムアウト設定が正しく適用されることを確認する
    - 環境変数からの設定読み込みを確認する
    - エラー時の例外伝播を確認する
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 7. API Route の実装
  - [x] 7.1 `src/app/api/ai-enrich/route.ts` を実装する
    - POST ハンドラを実装する
    - リクエストバリデーション: `url` フィールド必須チェック、URL フォーマット検証
    - バリデーション失敗時は HTTP 400 を返す
    - `BEDROCK_MODEL_ID` 環境変数未設定時は HTTP 200 + 空 EnrichmentResult を返す
    - プロンプトビルダーでプロンプトを構築する
    - Bedrock クライアントで InvokeModel を呼び出す
    - レスポンスパーサーで結果をパースする
    - Bedrock 呼び出し失敗時は HTTP 200 + 空 EnrichmentResult を返す（Graceful Degradation）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.3, 7.3, 7.4_

  - [ ]* 7.2 Property 2 のプロパティテストを書く
    - **Property 2: 無効な入力は常に拒否される**
    - 有効な URL フォーマットでない任意の文字列に対して、バリデーションロジックがエラーを返すことを検証する
    - **Validates: Requirements 1.3**

  - [ ]* 7.3 Property 3 のプロパティテストを書く
    - **Property 3: Bedrock 失敗時は常に空デフォルトを返す**
    - 任意の Bedrock クライアント失敗（タイムアウト、ネットワークエラー、サービスエラー、無効レスポンス）に対して、空デフォルト EnrichmentResult を返すことを検証する
    - **Validates: Requirements 1.4, 7.4**

  - [ ]* 7.4 API Route のユニットテストを書く
    - 正常系レスポンス構造の確認
    - URL 欠落時の HTTP 400 レスポンス確認
    - 無効 URL 時の HTTP 400 レスポンス確認
    - 環境変数未設定時の graceful degradation 確認
    - _Requirements: 1.1, 1.2, 1.3, 6.3_

- [x] 8. Checkpoint - バックエンド実装の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. フロントエンド統合: AI トグル
  - [x] 9.1 `src/hooks/useAIEnrichment.ts` フックを実装する
    - `useAIEnrichment(): { isAIEnabled: boolean; setAIEnabled: (enabled: boolean) => void }` を実装する
    - localStorage キー `ai-enrichment-enabled` で状態を永続化する
    - デフォルト値は `true`（ON）
    - state 変更時に即座に localStorage に書き込む
    - SSR 対応（初期値は `true`、クライアントサイドで localStorage から復元）
    - _Requirements: 9.4, 9.5, 9.7_

  - [x] 9.2 `src/app/page.tsx` のヘッダーに AI トグル UI を追加する
    - ヘッダーの `headerActions` 内、インポートボタンの左側にトグルスイッチを配置する
    - チェックボックス + ラベル（「AI 補完」）のコンパクトなトグル表示
    - `page.module.css` に `.aiToggle` スタイルを追加する
    - ON/OFF の視覚的インジケーターを表示する
    - _Requirements: 9.1, 9.6_

- [x] 10. フロントエンド統合: バックグラウンド AI 補完実行
  - [x] 10.1 `src/app/page.tsx` に `triggerAIEnrichment` 関数を実装する
    - OGP 取得完了後に `/api/ai-enrich` への非同期 POST リクエストを実行する
    - レスポンスの EnrichmentResult を受け取り、`mergeEnrichment` で空フィールドのみ更新する
    - `suggestedTags` を既存の `resolveTagId` + `addTagToBookmark` で適用する
    - エラー時は `console.warn` のみ（Bookmark は変更しない）
    - AbortController によるキャンセル対応
    - AI トグルが OFF の場合は呼び出しをスキップする
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 9.2, 9.3_

  - [x] 10.2 `handleQuickAdd` と `triggerOGPFetch` のフローに AI 補完を統合する
    - OGP 取得成功後に `triggerAIEnrichment` を呼び出すようフローを修正する
    - OGP 取得 → AI 補完の順序を保証する
    - QuickAdd の応答性を損なわないよう非同期で実行する
    - _Requirements: 5.1, 5.2_

- [x] 11. 環境変数と依存関係のセットアップ
  - [x] 11.1 環境変数と依存関係を設定する
    - `@aws-sdk/client-bedrock-runtime` を `package.json` に追加する
    - `.env.example` に `BEDROCK_MODEL_ID` と `BEDROCK_REGION` を追加する
    - _Requirements: 6.1, 6.2_

- [x] 12. Final checkpoint - 全体の動作確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- 純粋関数（パーサー、プロンプトビルダー、マージャー）を先に実装し、PBT で堅牢性を確認してから API Route とフロントエンド統合に進む構成

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "4.2"] },
    { "id": 3, "tasks": ["6.1", "11.1"] },
    { "id": 4, "tasks": ["6.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "9.1"] },
    { "id": 6, "tasks": ["9.2", "10.1"] },
    { "id": 7, "tasks": ["10.2"] }
  ]
}
```
