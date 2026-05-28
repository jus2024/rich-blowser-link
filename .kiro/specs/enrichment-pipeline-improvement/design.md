# Design Document: Enrichment Pipeline Improvement

## Overview

This design addresses critical reliability issues in the post-import enrichment pipeline. The current implementation suffers from a useEffect feedback loop that causes the EnrichmentQueue to be recreated (and aborted) whenever tags or collections change — which happens on every successful AI enrichment. Additionally, OGP fetches fire simultaneously without concurrency control, there is no retry logic for transient failures, and the AbortController is recreated on each `triggerOGPFetch` call, cancelling previous in-flight requests.

The improved architecture introduces:
1. A ref-based EnrichmentQueue lifecycle that survives React re-renders
2. A new OGPFetchQueue class with concurrency control (max 5)
3. A shared RetryHandler utility with exponential backoff
4. A unified PipelineProgress component showing both OGP and AI enrichment status
5. Stable AbortController management (one per pipeline session)

The pipeline flow remains: **Import → OGP Fetch → AI Enrichment**, but each stage now operates as a stable, independently managed queue connected by completion callbacks.

## Architecture

```mermaid
flowchart TD
    A[Import Complete] --> B[OGPFetchQueue]
    B -->|concurrency=5| C[/api/ogp]
    C -->|on success| D[EnrichmentQueue]
    D -->|concurrency=3| E[/api/ai-enrich]
    
    B -->|on failure| F[RetryHandler]
    D -->|on failure| F
    F -->|retry with backoff| C
    F -->|retry with backoff| E
    
    B -->|progress| G[PipelineProgress]
    D -->|progress| G
    
    H[AbortController] -->|signal| B
    H -->|signal| D
    H -->|signal| F
```

### Key Design Decisions

1. **Ref-based lifecycle over useEffect recreation**: The root cause of the feedback loop is that `EnrichmentQueue` is recreated in a `useEffect` that depends on `[tags, collections, applyEnrichmentResult, refreshBookmarks, refreshTags]`. Since AI enrichment creates new tags, this triggers the effect, aborting the queue. The fix uses `useRef` to hold a single queue instance and passes fresh state via a getter function rather than at construction time.

2. **OGPFetchQueue as a separate class**: OGP fetching has different concurrency needs (5 vs 3) and different retry semantics. A dedicated queue class following the same pattern as EnrichmentQueue keeps concerns separated while maintaining code consistency.

3. **RetryHandler as a composable utility**: Both queues need retry logic. A standalone function (`withRetry`) avoids duplicating backoff logic and is easily testable in isolation.

4. **Single AbortController per session**: Instead of creating a new controller per `triggerOGPFetch` call, one controller lives for the entire pipeline session (from first enqueue to all-complete or unmount). This prevents new imports from cancelling in-progress work.

## Components and Interfaces

### 1. RetryHandler (`src/lib/pipeline/retryHandler.ts`)

A pure utility function that wraps an async operation with retry logic.

```typescript
export interface RetryConfig {
  maxRetries: number;       // default: 2
  baseDelayMs: number;      // default: 1000
  signal?: AbortSignal;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Wraps an async function with exponential backoff retry.
 * - Retries on network errors and 5xx responses
 * - Does NOT retry on 4xx responses
 * - Respects AbortSignal during wait periods
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
): Promise<RetryResult<T>>;

/**
 * Determines if an error is retryable.
 * - Network errors (TypeError from fetch): retryable
 * - HTTP 5xx: retryable
 * - HTTP 4xx: NOT retryable
 * - AbortError: NOT retryable
 */
export function isRetryableError(error: unknown): boolean;

/**
 * Calculates delay for a given attempt number.
 * delay = baseDelayMs * 2^(attempt - 1)
 * attempt 1 → 1000ms, attempt 2 → 2000ms
 */
export function calculateDelay(attempt: number, baseDelayMs: number): number;

/**
 * Sleeps for the given duration, but resolves immediately if signal is aborted.
 * Returns true if sleep completed, false if aborted.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<boolean>;
```

### 2. OGPFetchQueue (`src/lib/pipeline/ogpFetchQueue.ts`)

Follows the same class pattern as the existing `EnrichmentQueue`.

```typescript
export interface OGPFetchItem {
  bookmarkId: string;
  url: string;
  hasCollectionId: boolean;
}

export interface OGPFetchResult {
  bookmarkId: string;
  url: string;
  title: string;
  description: string;
  imageUrl: string;
  hasCollectionId: boolean;
  success: boolean;
}

export interface OGPFetchQueueProgress {
  total: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

export interface OGPFetchQueueConfig {
  concurrency: number;          // default: 5
  signal?: AbortSignal;
  retryConfig?: RetryConfig;
  onItemComplete: (result: OGPFetchResult) => void;
  onProgress: (progress: OGPFetchQueueProgress) => void;
  onComplete: (result: { totalProcessed: number; failedCount: number }) => void;
}

export class OGPFetchQueue {
  private queue: OGPFetchItem[] = [];
  private inFlight: number = 0;
  private completed: number = 0;
  private failed: number = 0;
  private total: number = 0;
  private config: OGPFetchQueueConfig;
  private isProcessing: boolean = false;
  private aborted: boolean = false;

  constructor(config: OGPFetchQueueConfig);
  enqueue(item: OGPFetchItem): void;
  enqueueBatch(items: OGPFetchItem[]): void;
  start(): void;
  abort(): void;
  getProgress(): OGPFetchQueueProgress;

  private processNext(): void;
  private processItem(item: OGPFetchItem): Promise<void>;
  private emitProgress(): void;
  private checkCompletion(): void;
}
```

### 3. Refactored EnrichmentQueue (`src/lib/ai/enrichmentQueue.ts`)

The class interface remains the same, but the config adds:

```typescript
export interface EnrichmentQueueConfig {
  concurrency: number;
  /** Getter function for fresh tags at processing time */
  getExistingTags: () => string[];
  /** Getter function for fresh collections at processing time */
  getExistingCollections: () => string[];
  signal?: AbortSignal;
  retryConfig?: RetryConfig;
  onItemComplete: (result: EnrichmentItemResult) => void;
  onProgress: (progress: EnrichmentQueueProgress) => void;
  onComplete: (result: EnrichmentQueueResult) => void;
}
```

Key change: `existingTags` and `existingCollections` become **getter functions** (`getExistingTags`, `getExistingCollections`) that are called at the moment each item is processed, ensuring fresh state without requiring queue recreation.

### 4. PipelineProgress Component (`src/components/ai/PipelineProgress.tsx`)

Replaces `EnrichmentProgressBar`. Shows both OGP and AI enrichment progress.

```typescript
export interface PipelineProgressProps {
  ogpProgress: OGPFetchQueueProgress | null;
  enrichmentProgress: EnrichmentQueueProgress | null;
}

/**
 * Unified progress display for the enrichment pipeline.
 * - Shows OGP fetch progress when active
 * - Shows AI enrichment progress when active
 * - Shows both simultaneously when both are active
 * - Shows failed item counts
 * - Remains visible for 3 seconds after all stages complete
 * - Hidden when no stage is active and delay has elapsed
 */
export function PipelineProgress({ ogpProgress, enrichmentProgress }: PipelineProgressProps): JSX.Element | null;
```

CSS Module: `PipelineProgress.module.css` — follows the same pattern as `EnrichmentProgressBar.module.css` with two progress sections stacked vertically.

### 5. Pipeline Orchestration in `page.tsx`

The orchestration logic in `page.tsx` changes from useEffect-based to ref-based:

```typescript
// Single AbortController for the entire pipeline session
const pipelineAbortRef = useRef<AbortController | null>(null);

// Stable queue refs (never recreated)
const ogpQueueRef = useRef<OGPFetchQueue | null>(null);
const enrichmentQueueRef = useRef<EnrichmentQueue | null>(null);

// Fresh state refs for getter functions
const tagsRef = useRef(tags);
const collectionsRef = useRef(collections);
useEffect(() => { tagsRef.current = tags; }, [tags]);
useEffect(() => { collectionsRef.current = collections; }, [collections]);

// Initialize queues once (not in a dependency-heavy useEffect)
const getOrCreatePipeline = useCallback(() => {
  if (!pipelineAbortRef.current) {
    pipelineAbortRef.current = new AbortController();
  }
  if (!enrichmentQueueRef.current) {
    enrichmentQueueRef.current = new EnrichmentQueue({
      concurrency: 3,
      getExistingTags: () => tagsRef.current.map(t => t.name),
      getExistingCollections: () => collectionsRef.current.map(c => c.name),
      signal: pipelineAbortRef.current.signal,
      retryConfig: { maxRetries: 2, baseDelayMs: 1000 },
      onItemComplete: applyEnrichmentResultRef.current,
      onProgress: setEnrichmentProgress,
      onComplete: handleEnrichmentComplete,
    });
  }
  if (!ogpQueueRef.current) {
    ogpQueueRef.current = new OGPFetchQueue({
      concurrency: 5,
      signal: pipelineAbortRef.current.signal,
      retryConfig: { maxRetries: 2, baseDelayMs: 1000 },
      onItemComplete: handleOGPItemComplete,
      onProgress: setOGPProgress,
      onComplete: handleOGPComplete,
    });
  }
  return { ogpQueue: ogpQueueRef.current, enrichmentQueue: enrichmentQueueRef.current };
}, []);

// Cleanup on unmount only
useEffect(() => {
  return () => {
    pipelineAbortRef.current?.abort();
    ogpQueueRef.current?.abort();
    enrichmentQueueRef.current?.abort();
  };
}, []);
```

The `applyEnrichmentResult` callback is also stored in a ref to avoid stale closures:

```typescript
const applyEnrichmentResultRef = useRef(applyEnrichmentResult);
useEffect(() => { applyEnrichmentResultRef.current = applyEnrichmentResult; }, [applyEnrichmentResult]);
```

### 6. Pipeline Stage Connection

When an OGP fetch completes successfully, the item is enqueued to the AI enrichment queue:

```typescript
const handleOGPItemComplete = useCallback((result: OGPFetchResult) => {
  if (!result.success) return;
  
  // Update bookmark with OGP data
  const updates: Record<string, string> = {};
  if (result.title) updates.title = result.title;
  if (result.description) updates.description = result.description;
  if (result.imageUrl) updates.ogpImageUrl = result.imageUrl;
  if (Object.keys(updates).length > 0) {
    updateBookmark(result.bookmarkId, updates);
  }

  // Enqueue to AI enrichment (if enabled)
  if (isAIEnabled) {
    const { enrichmentQueue } = getOrCreatePipeline();
    enrichmentQueue.enqueue({
      bookmarkId: result.bookmarkId,
      url: result.url,
      ogpTitle: result.title || "",
      ogpDescription: result.description || "",
      hasCollectionId: result.hasCollectionId,
    });
  }
}, [updateBookmark, isAIEnabled, getOrCreatePipeline]);
```

## Data Models

No new database models are introduced. The changes are purely in-memory queue state and React component state.

### Pipeline State (in-memory)

```typescript
interface PipelineState {
  ogpProgress: OGPFetchQueueProgress | null;
  enrichmentProgress: EnrichmentQueueProgress | null;
  isActive: boolean;  // derived: either queue has pending/in-flight items
}
```

### Queue Item Lifecycle

```
[Pending] → [In-Flight] → [Completed | Failed]
                ↓ (on retryable failure)
           [Retry Wait] → [In-Flight] (up to 2 retries)
                ↓ (on abort)
           [Cancelled]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Queue resilience to external state changes

*For any* EnrichmentQueue with N items in various states (pending, in-flight), and *for any* change to the external tags or collections state during processing, the queue SHALL eventually process all N items to completion (success or max-retries-exhausted failure) without restarting or aborting.

**Validates: Requirements 1.1, 1.2**

### Property 2: Enqueue during processing preserves all items (EnrichmentQueue)

*For any* EnrichmentQueue currently processing items, and *for any* additional items enqueued during processing, the total number of items processed to completion (success + failure) SHALL equal the sum of the original items plus the newly enqueued items.

**Validates: Requirements 1.4**

### Property 3: Fresh state per item

*For any* sequence of tag/collection state changes interleaved with EnrichmentQueue item processing, each item's API request SHALL include the tags and collections that were current at the moment that specific item began processing, not the values from queue creation time.

**Validates: Requirements 1.5**

### Property 4: OGP concurrency invariant

*For any* batch of items submitted to the OGPFetchQueue, the number of simultaneously in-flight requests SHALL never exceed the configured concurrency limit (5), and all items SHALL eventually be processed.

**Validates: Requirements 2.1, 2.2**

### Property 5: Enqueue during processing preserves all items (OGPFetchQueue)

*For any* OGPFetchQueue currently processing items, and *for any* additional batch submitted via `enqueueBatch`, all items from both the original and new batches SHALL be processed without aborting in-flight requests from the original batch.

**Validates: Requirements 2.3, 5.1**

### Property 6: FIFO processing order

*For any* sequence of items enqueued to the OGPFetchQueue, the order in which items begin processing (transition from pending to in-flight) SHALL match the order in which they were enqueued.

**Validates: Requirements 2.4**

### Property 7: Retry count and backoff timing

*For any* request that fails with a retryable error (network error or HTTP 5xx), the RetryHandler SHALL make at most 2 additional attempts, with delays of `baseDelayMs * 2^(attempt-1)` milliseconds between each attempt (1s, 2s for default config).

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 8: Non-retryable errors are not retried

*For any* request that fails with an HTTP 4xx status code, the RetryHandler SHALL NOT retry the request and SHALL immediately return a failure result.

**Validates: Requirements 3.4**

### Property 9: Failed items don't block the queue

*For any* item that exhausts all retry attempts, the queue SHALL mark it as failed, increment the failed counter, and continue processing remaining pending items without interruption.

**Validates: Requirements 3.5**

### Property 10: Progress display correctness

*For any* combination of OGP and AI enrichment progress states, the PipelineProgress component SHALL render: (a) the OGP progress count if OGP is active, (b) the AI enrichment progress count if enrichment is active, (c) both simultaneously if both are active, (d) the failed item count if any items have failed, and (e) remain visible whenever any stage has pending or in-flight items.

**Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6**

## Error Handling

### Transient Failures (Network errors, 5xx)

- Handled by `RetryHandler` with exponential backoff (1s, 2s)
- After 2 retries exhausted: item marked as failed, queue continues
- Failed count displayed in PipelineProgress

### Client Errors (4xx)

- Not retried (indicates bad input, not transient failure)
- Item immediately marked as failed
- OGP 4xx: item still enqueued to AI enrichment with empty OGP data (graceful degradation)

### Abort/Cancellation

- `AbortSignal` propagated to all fetch calls and retry sleep periods
- On abort: all pending items discarded, in-flight requests cancelled via AbortError
- AbortError is silently caught (not counted as failure)

### Component Unmount

- Single cleanup in `useEffect` return: aborts the pipeline AbortController
- Both queues call `abort()` which clears pending items and sets aborted flag
- No memory leaks from orphaned promises (all fetch calls use the shared signal)

### Bedrock Timeout (AI Enrichment)

- The `/api/ai-enrich` route has an 8s Bedrock timeout
- On timeout: route returns `EMPTY_ENRICHMENT` (HTTP 200) — not a retryable error
- The queue treats this as a successful response with empty data

## Testing Strategy

### Property-Based Tests (using `fast-check`)

Each correctness property maps to a property-based test with minimum 100 iterations:

| Property | Test File | What's Generated |
|----------|-----------|-----------------|
| 1: Queue resilience | `retryHandler.property.test.ts` | Random queue sizes, random state change timing |
| 2: Enqueue preserves items (Enrichment) | `enrichmentQueue.property.test.ts` | Random initial items, random additional items, random timing |
| 3: Fresh state per item | `enrichmentQueue.property.test.ts` | Random tag/collection sequences interleaved with processing |
| 4: OGP concurrency invariant | `ogpFetchQueue.property.test.ts` | Random batch sizes (1-100) |
| 5: Enqueue preserves items (OGP) | `ogpFetchQueue.property.test.ts` | Random multi-batch scenarios |
| 6: FIFO order | `ogpFetchQueue.property.test.ts` | Random item sequences |
| 7: Retry count and backoff | `retryHandler.property.test.ts` | Random failure patterns, random attempt counts |
| 8: Non-retryable errors | `retryHandler.property.test.ts` | Random 4xx status codes |
| 9: Failed items don't block | `ogpFetchQueue.property.test.ts` | Random queues with random failure items |
| 10: Progress display | `PipelineProgress.property.test.ts` | Random pipeline state combinations |

**Test configuration:**
- Library: `fast-check` (already compatible with the project's Vitest setup)
- Minimum iterations: 100 per property
- Tag format: `Feature: enrichment-pipeline-improvement, Property N: <title>`
- Mocking: `fetch` is mocked to simulate various response patterns (success, 4xx, 5xx, network error, delays)

### Unit Tests (example-based)

- `RetryHandler`: abort during wait period cancels retry (Req 3.6)
- `PipelineProgress`: 3-second visibility delay after completion (Req 4.4)
- `AbortController`: single controller identity across multiple triggerOGPFetch calls (Req 5.2)
- `Pipeline cleanup`: unmount aborts all in-flight requests (Req 5.3)
- `Pipeline cancel`: explicit cancel clears queue and aborts (Req 5.4)
- `EnrichmentQueue`: stable ref across re-renders (Req 1.3)

### Integration Tests

- End-to-end pipeline: import → OGP fetch → AI enrichment → bookmark updated
- Verify OGP completion triggers AI enrichment enqueue
- Verify pipeline survives multiple rapid imports
