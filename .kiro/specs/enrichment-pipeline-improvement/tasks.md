# Implementation Plan: Enrichment Pipeline Improvement

## Overview

OGP フェッチと AI 補完パイプラインの信頼性を改善する。RetryHandler ユーティリティ、OGPFetchQueue クラス、EnrichmentQueue のリファクタ（getter 関数化）、統合 PipelineProgress コンポーネント、page.tsx の ref ベースオーケストレーションを段階的に実装する。各キューは独立して動作し、共有 AbortController で一括キャンセルを実現する。

## Tasks

- [x] 1. RetryHandler ユーティリティの実装
  - [x] 1.1 src/lib/pipeline/retryHandler.ts を作成
    - `withRetry<T>` 関数を実装（指数バックオフ付きリトライ）
    - `isRetryableError` 関数を実装（ネットワークエラー・5xx → retryable、4xx・AbortError → not retryable）
    - `calculateDelay` 関数を実装（`baseDelayMs * 2^(attempt-1)`）
    - `abortableSleep` 関数を実装（AbortSignal 対応の sleep）
    - `RetryConfig` と `RetryResult<T>` インターフェースをエクスポート
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 1.2 Property test: リトライ回数とバックオフタイミング
    - `src/lib/pipeline/__tests__/retryHandler.property.test.ts` を作成
    - fast-check を使用、最低 100 イテレーション
    - **Property 7: Retry count and backoff timing**
    - リトライ可能エラーで最大 2 回追加試行、遅延が `baseDelayMs * 2^(attempt-1)` であることを検証
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 1.3 Property test: 4xx エラーはリトライしない
    - `src/lib/pipeline/__tests__/retryHandler.property.test.ts` に追加
    - **Property 8: Non-retryable errors are not retried**
    - ランダムな 4xx ステータスコードで即座に失敗結果を返すことを検証
    - **Validates: Requirements 3.4**

  - [ ]* 1.4 Unit test: AbortSignal によるリトライキャンセル
    - `src/lib/pipeline/__tests__/retryHandler.test.ts` を作成
    - リトライ待機中に AbortSignal が発火した場合、即座にキャンセルされることを検証
    - **Validates: Requirements 3.6**

- [x] 2. OGPFetchQueue の実装
  - [x] 2.1 src/lib/pipeline/ogpFetchQueue.ts を作成
    - `OGPFetchQueue` クラスを実装（EnrichmentQueue と同パターン）
    - コンカレンシー制御（デフォルト 5）
    - FIFO 順序でのアイテム処理
    - `RetryHandler` を使用したリトライ対応
    - `OGPFetchItem`, `OGPFetchResult`, `OGPFetchQueueProgress`, `OGPFetchQueueConfig` インターフェースをエクスポート
    - `enqueue`, `enqueueBatch`, `start`, `abort`, `getProgress` メソッドを実装
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1_

  - [ ]* 2.2 Property test: OGP コンカレンシー不変条件
    - `src/lib/pipeline/__tests__/ogpFetchQueue.property.test.ts` を作成
    - **Property 4: OGP concurrency invariant**
    - ランダムなバッチサイズ（1-100）で同時 in-flight リクエストが 5 を超えないことを検証
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.3 Property test: 処理中の追加エンキューが全アイテムを保持
    - `src/lib/pipeline/__tests__/ogpFetchQueue.property.test.ts` に追加
    - **Property 5: Enqueue during processing preserves all items (OGPFetchQueue)**
    - 複数バッチ追加シナリオで全アイテムが処理されることを検証
    - **Validates: Requirements 2.3, 5.1**

  - [ ]* 2.4 Property test: FIFO 処理順序
    - `src/lib/pipeline/__tests__/ogpFetchQueue.property.test.ts` に追加
    - **Property 6: FIFO processing order**
    - アイテムが enqueue 順に処理開始されることを検証
    - **Validates: Requirements 2.4**

  - [ ]* 2.5 Property test: 失敗アイテムがキューをブロックしない
    - `src/lib/pipeline/__tests__/ogpFetchQueue.property.test.ts` に追加
    - **Property 9: Failed items don't block the queue**
    - リトライ上限到達後もキューが残りアイテムを処理し続けることを検証
    - **Validates: Requirements 3.5**

- [x] 3. Checkpoint - RetryHandler と OGPFetchQueue の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. EnrichmentQueue のリファクタ
  - [x] 4.1 src/lib/ai/enrichmentQueue.ts を getter 関数ベースに変更
    - `existingTags` / `existingCollections` を `getExistingTags: () => string[]` / `getExistingCollections: () => string[]` に変更
    - `processItem` 内で処理時点の最新値を取得するよう修正
    - `RetryHandler` を使用したリトライ対応を追加（`retryConfig` オプション）
    - 既存の `EnrichmentQueueItem`, `EnrichmentQueueProgress`, `EnrichmentQueueResult`, `EnrichmentItemResult` インターフェースは維持
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2_

  - [ ]* 4.2 Property test: 外部状態変更に対するキューの耐性
    - `src/lib/ai/__tests__/enrichmentQueue.property.test.ts` を作成
    - **Property 1: Queue resilience to external state changes**
    - 処理中にタグ・コレクション状態が変化してもキューが全アイテムを完了することを検証
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 4.3 Property test: 処理中の追加エンキューが全アイテムを保持
    - `src/lib/ai/__tests__/enrichmentQueue.property.test.ts` に追加
    - **Property 2: Enqueue during processing preserves all items (EnrichmentQueue)**
    - 追加エンキューされたアイテムを含め全アイテムが処理されることを検証
    - **Validates: Requirements 1.4**

  - [ ]* 4.4 Property test: アイテムごとに最新状態を使用
    - `src/lib/ai/__tests__/enrichmentQueue.property.test.ts` に追加
    - **Property 3: Fresh state per item**
    - 各アイテム処理時に getter 関数が呼ばれ、その時点の最新値が API リクエストに含まれることを検証
    - **Validates: Requirements 1.5**

- [x] 5. PipelineProgress コンポーネントの実装
  - [x] 5.1 src/components/ai/PipelineProgress.tsx を作成
    - `PipelineProgressProps` インターフェース（`ogpProgress`, `enrichmentProgress`）
    - OGP フェッチ進捗と AI 補完進捗を同時表示
    - 失敗アイテム数の表示
    - 全ステージ完了後 3 秒間表示を維持してから非表示
    - `role="progressbar"` と適切な aria 属性でアクセシビリティ対応
    - `PipelineProgress.module.css` を作成（2 セクション縦並び）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Property test: 進捗表示の正確性
    - `src/components/ai/__tests__/PipelineProgress.property.test.ts` を作成
    - **Property 10: Progress display correctness**
    - ランダムなパイプライン状態の組み合わせで正しい表示条件を検証
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6**

  - [ ]* 5.3 Unit test: 完了後 3 秒表示の検証
    - `src/components/ai/__tests__/PipelineProgress.test.ts` を作成
    - 全ステージ完了後 3 秒間表示が維持され、その後非表示になることを検証
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint - EnrichmentQueue リファクタと PipelineProgress の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. page.tsx のパイプラインオーケストレーション
  - [x] 7.1 ref ベースのキューライフサイクルを実装
    - `src/app/page.tsx` に `pipelineAbortRef`, `ogpQueueRef`, `enrichmentQueueRef` を追加
    - `tagsRef`, `collectionsRef` で最新状態を保持する useEffect を追加
    - `getOrCreatePipeline` コールバックを実装（キューの遅延初期化）
    - `applyEnrichmentResultRef` で最新コールバックを保持
    - アンマウント時の cleanup useEffect（abort + queue.abort）
    - _Requirements: 1.3, 5.2, 5.3, 5.4_

  - [x] 7.2 OGP → AI 補完のステージ接続を実装
    - `handleOGPItemComplete` コールバックを実装
    - OGP 成功時にブックマーク更新 + EnrichmentQueue へのエンキュー
    - `handleOGPComplete`, `handleEnrichmentComplete` コールバックを実装
    - 既存の `triggerOGPFetch` を `OGPFetchQueue.enqueueBatch` に置き換え
    - _Requirements: 2.3, 5.1_

  - [x] 7.3 PipelineProgress コンポーネントを統合
    - `EnrichmentProgressBar` を `PipelineProgress` に置き換え
    - `ogpProgress` と `enrichmentProgress` の state を追加
    - `PipelineProgress` に両方の progress を渡す
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 8. Final checkpoint - 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- TypeScript テストは `fast-check` + `vitest` を使用
- `fetch` はモックして各種レスポンスパターン（成功、4xx、5xx、ネットワークエラー、遅延）をシミュレート
- RetryHandler は純粋関数として実装し、テスト容易性を確保
- EnrichmentQueue の既存インターフェースは維持し、内部実装のみ変更（後方互換性）
- PipelineProgress は既存の EnrichmentProgressBar を置き換える

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "5.2", "5.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] }
  ]
}
```
