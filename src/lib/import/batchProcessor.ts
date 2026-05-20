/**
 * バッチ処理エンジン（ブックマークインポート用）
 *
 * Netscape Bookmark File からパースされたブックマーク群を、
 * Amplify Data API に効率的に投入するためのバッチ分割・処理ユーティリティ。
 */

import type { ImportProgress, ImportResult } from "./types";

/** デフォルトのバッチサイズ（件）。Requirements 10.5 参照。 */
export const DEFAULT_BATCH_SIZE = 50;

/** デフォルトのバッチ間遅延（ms）。API レート制限対策。 */
export const DEFAULT_BATCH_DELAY_MS = 100;

/**
 * 配列を固定サイズのバッチに分割する。
 *
 * - 入力の順序を保持する（items[0..batchSize-1] が batch 0 に入る）
 * - 入力長が batchSize の倍数でない場合、最後のバッチのみ短くなる
 * - 空配列の場合は空配列を返す
 * - batchSize が 1 未満の場合は RangeError を投げる
 *
 * Validates: Requirements 10.5
 *
 * @param items 分割対象の配列
 * @param batchSize 1 バッチあたりの最大要素数（既定 {@link DEFAULT_BATCH_SIZE}）
 * @returns バッチ配列。各要素は元の配列の部分配列
 */
export function splitIntoBatches<T>(
  items: T[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): T[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(
      `batchSize must be a positive integer, got ${batchSize}`,
    );
  }

  if (items.length === 0) {
    return [];
  }

  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    batches.push(items.slice(start, start + batchSize));
  }
  return batches;
}

/**
 * バッチ内の 1 件分の処理結果。
 *
 * - `success`: createItem が解決した（output 付き）
 * - `skipped`: skipUrls に含まれていたため処理されなかった
 * - `failed`: createItem が例外を投げた（error メッセージ付き）
 */
export interface BatchItemResult<TOutput = unknown> {
  status: "success" | "failed" | "skipped";
  /** 処理対象 URL（失敗時の追跡用） */
  url: string;
  /** 成功時の出力（例: 作成された Bookmark オブジェクト） */
  output?: TOutput;
  /** 失敗時のエラーメッセージ */
  error?: string;
}

/**
 * `processBatches` のオプション。
 *
 * - 入力は `url` プロパティを持つ任意の型の配列
 * - `createItem` は 1 件を作成する非同期関数（失敗時は throw）
 * - 進捗コールバックおよびキャンセル用 AbortSignal に対応
 */
export interface ProcessBatchesOptions<
  TInput extends { url: string },
  TOutput = unknown,
> {
  /** 処理対象の配列（呼び出し側で分割済みでなくてよい。内部で分割する） */
  items: TInput[];
  /** 処理をスキップする URL のセット（重複スキップ戦略用） */
  skipUrls?: Set<string>;
  /** 1 件を作成する非同期関数。失敗時は throw する想定。 */
  createItem: (item: TInput, signal: AbortSignal) => Promise<TOutput>;
  /** バッチサイズ（既定 {@link DEFAULT_BATCH_SIZE}） */
  batchSize?: number;
  /** バッチ間の遅延 ms（既定 {@link DEFAULT_BATCH_DELAY_MS}） */
  batchDelayMs?: number;
  /** 各バッチ完了後に現在の累計進捗を通知 */
  onProgress?: (progress: ImportProgress) => void;
  /** 各バッチ完了時にそのバッチの結果を通知 */
  onBatchComplete?: (
    batchIndex: number,
    results: BatchItemResult<TOutput>[],
  ) => void;
  /** キャンセル用 AbortSignal。現在バッチの完了を待って停止する。 */
  signal?: AbortSignal;
}

/**
 * インポート結果サマリーに差し込む付加情報。
 *
 * Bookmark とは別軸のカウント（例: 作成済み Collection 数）を
 * 呼び出し側から渡すためのフィールド群。
 */
export interface ProcessBatchesExtras {
  /** 本処理外で作成された Collection 件数 */
  createdCollections?: number;
}

/**
 * 配列をバッチに分割して順次処理するエンジン。
 *
 * 振る舞い:
 * - `skipUrls` に含まれる URL は `createItem` を呼ばず `skipped` とする
 * - バッチ内は `Promise.allSettled` で並列実行し、個別失敗でもバッチは継続する
 * - バッチ完了ごとに `onProgress` と `onBatchComplete` を呼ぶ
 * - バッチ間に `batchDelayMs` の待機を挟む（キャンセル済みの場合はスキップ）
 * - `signal.aborted` が真になった時点で次バッチへ進まず処理を停止する
 * - 残り時間推定は直近 3 バッチの平均処理時間を用いる（1 バッチ未処理なら null）
 *
 * Validates: Requirements 10.5, 10.6, 10.11
 */
export async function processBatches<
  TInput extends { url: string },
  TOutput = unknown,
>(
  options: ProcessBatchesOptions<TInput, TOutput>,
  extras?: ProcessBatchesExtras,
): Promise<ImportResult> {
  const {
    items,
    skipUrls,
    createItem,
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelayMs = DEFAULT_BATCH_DELAY_MS,
    onProgress,
    onBatchComplete,
    signal,
  } = options;

  const startTime = Date.now();
  const batches = splitIntoBatches(items, batchSize);
  const totalCount = items.length;
  const totalBatches = batches.length;

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  const failedUrls: string[] = [];

  // 直近 3 バッチの処理時間（ms）を保持して EMA 風の残り時間推定に使う。
  const recentDurationsMs: number[] = [];
  const MAX_RECENT_DURATIONS = 3;

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    if (signal?.aborted) {
      break;
    }

    const batch = batches[batchIndex];
    const batchStart = Date.now();

    // skipUrls に合致する項目はスキップ扱い。それ以外は createItem を並列実行する。
    const batchResults: BatchItemResult<TOutput>[] = new Array(batch.length);
    const pendingIndices: number[] = [];
    const pendingPromises: Promise<TOutput>[] = [];

    for (let i = 0; i < batch.length; i += 1) {
      const item = batch[i];
      if (skipUrls?.has(item.url)) {
        batchResults[i] = { status: "skipped", url: item.url };
        continue;
      }
      pendingIndices.push(i);
      pendingPromises.push(createItem(item, signal ?? new AbortController().signal));
    }

    const settled = await Promise.allSettled(pendingPromises);

    for (let j = 0; j < settled.length; j += 1) {
      const resultIndex = pendingIndices[j];
      const item = batch[resultIndex];
      const outcome = settled[j];

      if (outcome.status === "fulfilled") {
        batchResults[resultIndex] = {
          status: "success",
          url: item.url,
          output: outcome.value,
        };
      } else {
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason ?? "unknown error");
        batchResults[resultIndex] = {
          status: "failed",
          url: item.url,
          error: message,
        };
      }
    }

    for (const r of batchResults) {
      if (r.status === "success") {
        successCount += 1;
      } else if (r.status === "skipped") {
        skippedCount += 1;
      } else {
        failedCount += 1;
        failedUrls.push(r.url);
      }
    }
    processedCount += batchResults.length;

    const batchDurationMs = Date.now() - batchStart;
    recentDurationsMs.push(batchDurationMs);
    if (recentDurationsMs.length > MAX_RECENT_DURATIONS) {
      recentDurationsMs.shift();
    }

    const percentage =
      totalCount === 0
        ? 100
        : Math.round((processedCount / totalCount) * 100);

    let estimatedRemainingSeconds: number | null = null;
    const remainingBatches = totalBatches - (batchIndex + 1);
    if (recentDurationsMs.length > 0 && remainingBatches > 0) {
      const avg =
        recentDurationsMs.reduce((a, b) => a + b, 0) / recentDurationsMs.length;
      estimatedRemainingSeconds = Math.max(
        0,
        Math.round((avg * remainingBatches) / 1000),
      );
    }

    const progress: ImportProgress = {
      status: "importing",
      processedCount,
      totalCount,
      percentage,
      estimatedRemainingSeconds,
      currentBatch: batchIndex + 1,
      totalBatches,
    };

    onProgress?.(progress);
    onBatchComplete?.(batchIndex, batchResults);

    const isLast = batchIndex === totalBatches - 1;
    if (!isLast && !signal?.aborted && batchDelayMs > 0) {
      await delay(batchDelayMs, signal);
    }
  }

  return {
    successCount,
    skippedCount,
    failedCount,
    createdCollections: extras?.createdCollections ?? 0,
    failedUrls,
    duration: Date.now() - startTime,
  };
}

/**
 * 指定 ms だけ待機する。`signal` が中断されたら早期に解決する。
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    if (signal?.aborted) {
      clearTimeout(timer);
      resolve();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
