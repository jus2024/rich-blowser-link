# Requirements Document

## Introduction

This document specifies requirements for improving the OGP fetch and AI enrichment pipeline that runs after bookmark import. The current implementation has critical issues causing the pipeline to stop midway through large imports due to a useEffect feedback loop, unbatched OGP requests, lack of retry logic, and AbortController reuse. The improvements aim to make the pipeline reliably process all items without stopping, with clear progress indication throughout.

## Glossary

- **Pipeline**: The sequential process of OGP fetching followed by AI enrichment that runs after bookmark import
- **OGP_Fetcher**: The module responsible for fetching Open Graph Protocol metadata from external URLs via the /api/ogp endpoint
- **Enrichment_Queue**: The concurrency-controlled queue (src/lib/ai/enrichmentQueue.ts) that processes AI enrichment requests via the /api/ai-enrich endpoint
- **Progress_Display**: The UI component showing the combined status of OGP fetching and AI enrichment processing
- **Batch_Processor**: The module that controls concurrent execution of OGP fetch requests with a configurable concurrency limit
- **Retry_Handler**: The module responsible for retrying failed OGP fetch and AI enrichment requests with exponential backoff

## Requirements

### Requirement 1: Decouple Enrichment Queue Lifecycle from State Changes

**User Story:** As a user importing bookmarks, I want the AI enrichment process to continue running even when tags or collections are created during processing, so that all imported items are enriched without interruption.

#### Acceptance Criteria

1. WHEN the Enrichment_Queue is processing items AND a new tag is created by the AI enrichment result, THE Pipeline SHALL continue processing remaining queued items without interruption
2. WHEN the Enrichment_Queue is processing items AND the collections state changes, THE Pipeline SHALL continue processing remaining queued items without interruption
3. THE Enrichment_Queue SHALL maintain a stable reference across React re-renders using a ref-based lifecycle independent of tags and collections state
4. WHEN new items are enqueued to the Enrichment_Queue while processing is in progress, THE Enrichment_Queue SHALL append the new items to the existing queue without aborting in-flight requests
5. THE Enrichment_Queue SHALL receive the latest existingTags and existingCollections values at the time each individual item is processed, not at queue creation time

### Requirement 2: Batch OGP Fetching with Concurrency Control

**User Story:** As a user importing many bookmarks, I want OGP fetching to be rate-limited, so that external servers are not overwhelmed and requests are not throttled or blocked.

#### Acceptance Criteria

1. WHEN the OGP_Fetcher receives a batch of items to fetch, THE Batch_Processor SHALL limit concurrent OGP requests to a maximum of 5 simultaneous requests
2. WHILE the Batch_Processor has pending items AND fewer than 5 requests are in-flight, THE Batch_Processor SHALL dequeue and start the next OGP fetch request
3. WHEN a new batch of items is submitted to the OGP_Fetcher while a previous batch is still processing, THE OGP_Fetcher SHALL append the new items to the pending queue without aborting in-flight requests from the previous batch
4. THE Batch_Processor SHALL process items in FIFO order

### Requirement 3: Retry Failed Requests with Exponential Backoff

**User Story:** As a user, I want failed OGP fetches and AI enrichment requests to be retried automatically, so that transient errors do not result in permanently missing metadata.

#### Acceptance Criteria

1. WHEN an OGP fetch request fails due to a network error or HTTP 5xx response, THE Retry_Handler SHALL retry the request up to 2 additional times
2. WHEN an AI enrichment request fails due to a network error or HTTP 5xx response, THE Retry_Handler SHALL retry the request up to 2 additional times
3. THE Retry_Handler SHALL wait an exponentially increasing delay between retries, starting at 1 second and doubling for each subsequent retry (1s, 2s)
4. WHEN a request fails with an HTTP 4xx response, THE Retry_Handler SHALL NOT retry the request
5. WHEN a request has exhausted all retry attempts, THE Pipeline SHALL mark the item as failed and continue processing remaining items
6. IF the AbortSignal is triggered during a retry wait period, THEN THE Retry_Handler SHALL cancel the pending retry and stop processing that item

### Requirement 4: Unified Progress Display

**User Story:** As a user, I want to see the combined progress of both OGP fetching and AI enrichment in a single progress indicator, so that I can understand the overall status of the post-import processing.

#### Acceptance Criteria

1. WHILE the OGP_Fetcher is processing items, THE Progress_Display SHALL show the OGP fetch progress as a count of completed items out of total items
2. WHILE the Enrichment_Queue is processing items, THE Progress_Display SHALL show the AI enrichment progress as a count of completed items out of total items
3. THE Progress_Display SHALL show both OGP and AI enrichment progress simultaneously when both are active
4. WHEN both the OGP_Fetcher and the Enrichment_Queue have completed all items, THE Progress_Display SHALL remain visible for 3 seconds before hiding
5. WHEN items fail during processing, THE Progress_Display SHALL show the count of failed items
6. THE Progress_Display SHALL remain visible as long as any pipeline stage has pending or in-flight items, regardless of intermediate state changes

### Requirement 5: Stable AbortController Management

**User Story:** As a user, I want adding new bookmarks during an ongoing import to not cancel the processing of previously imported items, so that all items are eventually processed.

#### Acceptance Criteria

1. WHEN triggerOGPFetch is called while a previous OGP batch is still processing, THE OGP_Fetcher SHALL NOT abort in-flight requests from the previous batch
2. THE OGP_Fetcher SHALL use a single long-lived AbortController per pipeline session rather than creating a new AbortController per triggerOGPFetch call
3. WHEN the user navigates away from the page or the component unmounts, THE Pipeline SHALL abort all in-flight OGP and AI enrichment requests via the AbortController
4. WHEN the Pipeline is explicitly cancelled by the user, THE Pipeline SHALL abort all in-flight requests and clear the pending queue
