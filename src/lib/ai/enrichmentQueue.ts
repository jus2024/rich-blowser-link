/**
 * AI Enrichment Queue - バッチ処理キューモジュール
 *
 * React に依存しない純粋な TypeScript モジュール。
 * コンカレンシー制御付きで AI 補完リクエストをキューイングし順次処理する。
 * getter 関数ベースで最新の tags/collections を取得し、キュー再生成なしに
 * React 状態変更に耐性を持つ。
 */

import { EnrichmentResult } from "./types";
import { withRetry, RetryConfig } from "../pipeline/retryHandler";

/** キューに投入するアイテム */
export interface EnrichmentQueueItem {
  bookmarkId: string;
  url: string;
  ogpTitle: string;
  ogpDescription: string;
  /** folder-inherit モードで collectionId が既に設定されている場合 true */
  hasCollectionId: boolean;
}

/** キューの進捗情報 */
export interface EnrichmentQueueProgress {
  total: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

/** キュー完了時のシグナル */
export interface EnrichmentQueueResult {
  totalProcessed: number;
  failedCount: number;
}

/** アイテム完了時のコールバック引数 */
export interface EnrichmentItemResult {
  bookmarkId: string;
  enrichmentResult: EnrichmentResult | null;
  hasCollectionId: boolean;
}

/** キューのコンフィグ */
export interface EnrichmentQueueConfig {
  concurrency: number;
  /** 処理時点の最新タグ一覧を返す getter 関数 */
  getExistingTags: () => string[];
  /** 処理時点の最新コレクション一覧を返す getter 関数 */
  getExistingCollections: () => string[];
  signal?: AbortSignal;
  retryConfig?: RetryConfig;
  onItemComplete: (result: EnrichmentItemResult) => void;
  onProgress: (progress: EnrichmentQueueProgress) => void;
  onComplete: (result: EnrichmentQueueResult) => void;
}

export class EnrichmentQueue {
  private queue: EnrichmentQueueItem[] = [];
  private inFlight = 0;
  private completed = 0;
  private failed = 0;
  private total = 0;
  private config: EnrichmentQueueConfig;
  private isProcessing = false;
  private aborted = false;

  constructor(config: EnrichmentQueueConfig) {
    this.config = config;
  }

  /** アイテムをキューに追加。処理中なら末尾に追加して自動的に処理開始 */
  enqueue(item: EnrichmentQueueItem): void {
    if (this.aborted) return;
    this.queue.push(item);
    this.total++;
    this.emitProgress();
    this.processNext();
  }

  /** 複数アイテムを一括追加 */
  enqueueBatch(items: EnrichmentQueueItem[]): void {
    if (this.aborted) return;
    for (const item of items) {
      this.queue.push(item);
      this.total++;
    }
    this.emitProgress();
    this.processNext();
  }

  /** キュー処理を開始（既に処理中なら何もしない） */
  start(): void {
    if (this.aborted) return;
    this.processNext();
  }

  /** 全ての pending リクエストを中断 */
  abort(): void {
    this.aborted = true;
    this.isProcessing = false;
    this.queue = [];
  }

  /** 現在の進捗を取得 */
  getProgress(): EnrichmentQueueProgress {
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      isProcessing: this.isProcessing,
    };
  }

  private processNext(): void {
    if (this.aborted) return;
    if (this.config.signal?.aborted) {
      this.aborted = true;
      this.isProcessing = false;
      return;
    }

    // コンカレンシー制御: inFlight が上限未満かつキューにアイテムがある場合のみ処理
    while (this.inFlight < this.config.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.inFlight++;
      this.isProcessing = true;
      this.emitProgress();
      this.processItem(item);
    }
  }

  private async processItem(item: EnrichmentQueueItem): Promise<void> {
    try {
      // AbortSignal チェック
      if (this.aborted || this.config.signal?.aborted) {
        this.inFlight--;
        this.checkCompletion();
        return;
      }

      // 処理時点の最新値を getter 関数から取得
      const existingTags = this.config.getExistingTags();
      const existingCollections = this.config.getExistingCollections();

      const fetchFn = async () => {
        const response = await fetch("/api/ai-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            ogpTitle: item.ogpTitle,
            ogpDescription: item.ogpDescription,
            existingTags,
            existingCollections,
          }),
          signal: this.config.signal,
        });

        if (!response.ok) {
          throw new Error(`AI enrich API returned ${response.status}`);
        }

        return response.json() as Promise<EnrichmentResult>;
      };

      let result: EnrichmentResult;

      if (this.config.retryConfig) {
        const retryResult = await withRetry(fetchFn, {
          ...this.config.retryConfig,
          signal: this.config.signal,
        });

        // AbortSignal チェック（リトライ後）
        if (this.aborted || this.config.signal?.aborted) {
          this.inFlight--;
          this.checkCompletion();
          return;
        }

        if (!retryResult.success) {
          throw retryResult.error || new Error("Retry exhausted");
        }

        result = retryResult.data!;
      } else {
        result = await fetchFn();

        // AbortSignal チェック（fetch 後）
        if (this.aborted || this.config.signal?.aborted) {
          this.inFlight--;
          this.checkCompletion();
          return;
        }
      }

      this.completed++;
      this.inFlight--;

      this.config.onItemComplete({
        bookmarkId: item.bookmarkId,
        enrichmentResult: result,
        hasCollectionId: item.hasCollectionId,
      });
    } catch (err: unknown) {
      // AbortError は無視（signal による中断）
      if (err instanceof Error && err.name === "AbortError") {
        this.inFlight--;
        this.checkCompletion();
        return;
      }

      console.warn("[EnrichmentQueue] Item failed:", item.bookmarkId, err);
      this.completed++;
      this.failed++;
      this.inFlight--;

      this.config.onItemComplete({
        bookmarkId: item.bookmarkId,
        enrichmentResult: null,
        hasCollectionId: item.hasCollectionId,
      });
    }

    this.emitProgress();
    this.processNext();
    this.checkCompletion();
  }

  private emitProgress(): void {
    this.config.onProgress({
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      isProcessing: this.isProcessing,
    });
  }

  private checkCompletion(): void {
    if (this.aborted) return;
    if (this.queue.length === 0 && this.inFlight === 0 && this.isProcessing) {
      this.isProcessing = false;
      this.emitProgress();
      this.config.onComplete({
        totalProcessed: this.completed,
        failedCount: this.failed,
      });
    }
  }
}
