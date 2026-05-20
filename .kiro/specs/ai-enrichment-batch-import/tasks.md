# Implementation Plan: AI Enrichment Batch Import

## Overview

本実装では、AI 補完のバッチ処理キュー（EnrichmentQueue）を新規モジュールとして追加し、既存の `triggerAIEnrichment` を置き換える。また、インポート時の Collection モード選択 UI を ImportDialog に追加し、フラットインポート時は AI が既存 Collection に振り分ける動作を実現する。

## Tasks

- [x] 1. EnrichmentQueue モジュールの実装
  - [x] 1.1 EnrichmentQueue の型定義とクラス実装
    - `src/lib/ai/enrichmentQueue.ts` を新規作成
    - `EnrichmentQueueItem`, `EnrichmentQueueProgress`, `EnrichmentQueueResult`, `EnrichmentItemResult`, `EnrichmentQueueConfig` インターフェースを定義
    - `EnrichmentQueue` クラスを実装: `enqueue()`, `enqueueBatch()`, `start()`, `abort()`, `getProgress()` メソッド
    - コンカレンシー制御（最大3同時リクエスト）を実装
    - `/api/ai-enrich` への fetch 呼び出しと AbortSignal 対応
    - 個別失敗時のエラーハンドリング（console.warn + スキップ）
    - `onItemComplete`, `onProgress`, `onComplete` コールバック呼び出し
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ]* 1.2 Property test: All enqueued items are processed
    - **Property 1: All enqueued items are processed**
    - fast-check で任意の N 件のキューアイテムを生成し、全件が onItemComplete で報告されることを検証
    - **Validates: Requirements 1.1**

  - [ ]* 1.3 Property test: Concurrency invariant
    - **Property 2: Concurrency invariant**
    - fast-check で任意のタイミングで enqueue し、同時 in-flight 数が concurrency limit を超えないことを検証
    - **Validates: Requirements 1.2**

  - [ ]* 1.4 Property test: Dynamic enqueue preserves processing
    - **Property 3: Dynamic enqueue preserves processing**
    - 処理中に追加されたアイテムも最終的に全て処理されることを検証
    - **Validates: Requirements 1.3**

  - [ ]* 1.5 Property test: Error isolation
    - **Property 4: Error isolation**
    - 任意のアイテムが失敗しても他のアイテムが正常に処理されることを検証
    - **Validates: Requirements 1.5**

  - [ ]* 1.6 Property test: Completion signal accuracy
    - **Property 5: Completion signal accuracy**
    - onComplete の totalProcessed と failedCount が実際の処理結果と一致することを検証
    - **Validates: Requirements 1.6, 6.4**

- [x] 2. ImportCollectionMode 型定義と useImport の変更
  - [x] 2.1 ImportCollectionMode 型の追加と useImport の startImport 引数拡張
    - `src/lib/ai/types.ts` に `ImportCollectionMode` 型を追加（"folder-inherit" | "flat"）
    - `src/hooks/useImport.ts` の `startImport` に `collectionMode` 引数を追加（デフォルト "folder-inherit"）
    - `collectionMode === "flat"` の場合、Collection 作成ループ（sortedPaths イテレーション）をスキップ
    - `collectionMode === "flat"` の場合、`assignBookmarkToCollection` 呼び出しをスキップ（collectionId を null のまま保持）
    - ImportResult の `createdCollections` を flat モード時は 0 に設定
    - _Requirements: 5.1, 5.5_

  - [ ]* 2.2 Property test: Flat-mode initial state
    - **Property 8: Flat-mode initial state**
    - flat モードでインポートされた全ブックマークの collectionId が null であることを検証
    - **Validates: Requirements 5.1**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. ImportDialog の Collection モード選択 UI 追加
  - [x] 4.1 ImportDialog に collectionMode ラジオボタングループを追加
    - `src/components/import/ImportDialog.tsx` の Preview ステージにラジオボタングループを追加
    - `collectionMode` state を追加（デフォルト "folder-inherit"）
    - "フォルダ構成を引き継ぐ" 選択時はフォルダプレビューを表示（既存動作）
    - "フラットに取り込む" 選択時はメッセージを表示（AI が Collection を提案する旨）
    - `startImport` 呼び出し時に `collectionMode` を渡す
    - CSS モジュールにスタイルを追加
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Unit test: ImportDialog の collectionMode UI
    - ラジオボタンのデフォルト値、選択切り替え、表示切り替えを検証
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. page.tsx の triggerAIEnrichment を EnrichmentQueue に置き換え
  - [x] 5.1 page.tsx に EnrichmentQueue インスタンスを導入
    - 既存の `aiAbortRef` と `triggerAIEnrichment` 関数を削除
    - `enrichmentQueueRef` (useRef) と `enrichmentProgress` (useState) を追加
    - `useEffect` で EnrichmentQueue インスタンスを初期化（concurrency: 3, existingTags, existingCollections）
    - `onItemComplete` コールバックで `applyEnrichmentResult` を呼び出す
    - `onProgress` で `setEnrichmentProgress` を呼び出す
    - `onComplete` で 3 秒後に進捗表示を非表示にする
    - cleanup で `queue.abort()` を呼び出す
    - _Requirements: 1.1, 1.2, 1.4, 2.5_

  - [x] 5.2 applyEnrichmentResult 関数の実装
    - `page.tsx` 内に `applyEnrichmentResult` を useCallback で実装
    - `hasCollectionId` が false の場合のみ `suggestedCollection` を適用
    - `suggestedCollection` が既存 Collection 名にマッチする場合のみ collectionId を設定
    - suggestedTags の適用ロジック（resolveTagId + addTagToBookmark）
    - suggestedTitle, suggestedDescription, suggestedMemo の適用
    - _Requirements: 2.3, 4.2, 4.3, 5.2, 5.3, 5.4, 7.3_

  - [ ]* 5.3 Property test: Folder-mode enrichment preserves collectionId
    - **Property 7: Folder-mode enrichment preserves collectionId**
    - hasCollectionId が true のアイテムで suggestedCollection が無視されることを検証
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 5.4 Property test: Collection resolution from suggestedCollection
    - **Property 9: Collection resolution from suggestedCollection**
    - suggestedCollection が既存 Collection 名にマッチする場合に collectionId が設定されることを検証
    - **Validates: Requirements 5.2, 5.3, 7.3**

  - [ ]* 5.5 Property test: Non-matching suggestedCollection leaves collectionId null
    - **Property 10: Non-matching suggestedCollection leaves collectionId null**
    - suggestedCollection が既存 Collection 名にマッチしない場合に collectionId が null のままであることを検証
    - **Validates: Requirements 5.4**

- [x] 6. triggerOGPFetch の enqueue 統合
  - [x] 6.1 triggerOGPFetch 内の AI 補完呼び出しを enqueue に置き換え
    - `triggerOGPFetch` 内の `triggerAIEnrichment` 呼び出しを `enrichmentQueueRef.current?.enqueue()` に置き換え
    - QuickAdd 時は `hasCollectionId: false` で enqueue
    - Import 完了後の OGP 取得成功時も同じ enqueue パスを使用
    - `isAIEnabled` が OFF の場合は enqueue しない
    - Import の folder-inherit モード時は `hasCollectionId: true` で enqueue
    - Import の flat モード時は `hasCollectionId: false` で enqueue
    - _Requirements: 2.1, 2.2, 2.4, 7.1, 7.2_

  - [ ]* 6.2 Property test: Bookmark update on enrichment completion
    - **Property 6: Bookmark update on enrichment completion**
    - AI 補完成功時に非空フィールドが Bookmark に反映されることを検証
    - **Validates: Requirements 2.3**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. EnrichmentProgressBar コンポーネントの実装
  - [x] 8.1 EnrichmentProgressBar コンポーネントの作成と配置
    - `src/components/ai/EnrichmentProgressBar.tsx` を新規作成
    - `EnrichmentQueueProgress | null` を props として受け取る
    - `isProcessing` が false または null の場合は非表示
    - プログレスバー（完了数/合計数）と失敗数の表示
    - `role="progressbar"` と `aria-valuenow` でアクセシビリティ対応
    - CSS モジュール（`EnrichmentProgressBar.module.css`）でスタイリング
    - `page.tsx` の BookmarkToolbar 直下に配置
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.2 Unit test: EnrichmentProgressBar の表示ロジック
    - null 時の非表示、処理中の表示、失敗数の表示、完了後の非表示を検証
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- EnrichmentQueue は React に依存しない純粋な TypeScript モジュールとして実装し、テスタビリティを確保する
- fast-check を property-based testing ライブラリとして使用する

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6", "2.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "6.2", "8.1"] },
    { "id": 5, "tasks": ["8.2"] }
  ]
}
```
