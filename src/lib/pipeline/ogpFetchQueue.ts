/**
 * OGPFetchQueue - OGP メタデータ取得キューモジュール
 *
 * React に依存しない純粋な TypeScript モジュール。
 * コンカレンシー制御付きで OGP フェッチリクエストをキューイングし FIFO 順で処理する。
 * RetryHandler を使用した指数バックオフ付きリトライに対応。
 */

import { RetryConfig, withRetry } from "./retryHandler";

/** キューに投入するアイテム */
export interface OGPFetchItem {
  bookmarkId: string;
  url: string;
  hasCollectionId: boolean;
}

/** OGP フェッチ結果 */
export interface OGPFetchResult {
  bookmarkId: string;
  url: string;
  title: string;
  description: string;
  imageUrl: string;
  hasCollectionId: boolean;
  success: boolean;
}

/** キューの進捗情報 */
export interface OGPFetchQueueProgress {
  total: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

/** キューのコンフィグ */
export interface OGPFetchQueueConfig {
  concurrency: number; // default: 5
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

  constructor(config: OGPFetchQueueConfig) {
    this.config = config;
  }

  /** アイテムをキューに追加。処理中なら末尾に追加して自動的に処理開始 */
  enqueue(item: OGPFetchItem): void {
    if (this.aborted) return;
    this.queue.push(item);
    this.total++;
    this.emitProgress();
    this.processNext();
  }

  /** 複数アイテムを一括追加。in-flight リクエストを中断せずに追加 */
  enqueueBatch(items: OGPFetchItem[]): void {
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
  getProgress(): OGPFetchQueueProgress {
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

  private async processItem(item: OGPFetchItem): Promise<void> {
    try {
      // AbortSignal チェック
      if (this.aborted || this.config.signal?.aborted) {
        this.inFlight--;
        this.checkCompletion();
        return;
      }

      const retryConfig: RetryConfig = this.config.retryConfig ?? {
        maxRetries: 2,
        baseDelayMs: 1000,
        signal: this.config.signal,
      };

      // signal が retryConfig に含まれていない場合は追加
      const effectiveRetryConfig: RetryConfig = {
        ...retryConfig,
        signal: retryConfig.signal ?? this.config.signal,
      };

      const retryResult = await withRetry(async () => {
        const response = await fetch("/api/ogp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url }),
          signal: this.config.signal,
        });

        if (!response.ok) {
          throw new Error(`OGP API returned ${response.status}`);
        }

        return response.json();
      }, effectiveRetryConfig);

      // AbortSignal チェック（リトライ後）
      if (this.aborted || this.config.signal?.aborted) {
        this.inFlight--;
        this.checkCompletion();
        return;
      }

      if (retryResult.success && retryResult.data) {
        this.completed++;
        this.inFlight--;

        const result: OGPFetchResult = {
          bookmarkId: item.bookmarkId,
          url: item.url,
          title: retryResult.data.title ?? "",
          description: retryResult.data.description ?? "",
          imageUrl: retryResult.data.imageUrl ?? retryResult.data.image ?? "",
          hasCollectionId: item.hasCollectionId,
          success: true,
        };

        this.config.onItemComplete(result);
      } else {
        // リトライ上限到達 or リトライ不可エラー
        this.completed++;
        this.failed++;
        this.inFlight--;

        const result: OGPFetchResult = {
          bookmarkId: item.bookmarkId,
          url: item.url,
          title: "",
          description: "",
          imageUrl: "",
          hasCollectionId: item.hasCollectionId,
          success: false,
        };

        this.config.onItemComplete(result);
      }
    } catch (err: unknown) {
      // AbortError は無視（signal による中断）
      if (err instanceof Error && err.name === "AbortError") {
        this.inFlight--;
        this.checkCompletion();
        return;
      }

      console.warn("[OGPFetchQueue] Item failed:", item.bookmarkId, err);
      this.completed++;
      this.failed++;
      this.inFlight--;

      const result: OGPFetchResult = {
        bookmarkId: item.bookmarkId,
        url: item.url,
        title: "",
        description: "",
        imageUrl: "",
        hasCollectionId: item.hasCollectionId,
        success: false,
      };

      this.config.onItemComplete(result);
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
