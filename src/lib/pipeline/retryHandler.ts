/**
 * RetryHandler - 指数バックオフ付きリトライユーティリティ
 *
 * React に依存しない純粋な TypeScript モジュール。
 * ネットワークエラーや 5xx レスポンスに対して指数バックオフでリトライを行う。
 * AbortSignal によるキャンセルに対応。
 */

/** リトライ設定 */
export interface RetryConfig {
  maxRetries: number; // default: 2
  baseDelayMs: number; // default: 1000
  signal?: AbortSignal;
}

/** リトライ結果 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * エラーがリトライ可能かどうかを判定する。
 * - ネットワークエラー (TypeError from fetch): retryable
 * - HTTP 5xx: retryable
 * - HTTP 4xx: NOT retryable
 * - AbortError: NOT retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // AbortError は常にリトライ不可
  if (error.name === "AbortError") {
    return false;
  }

  // TypeError はネットワークエラー（fetch が接続できない場合）→ retryable
  if (error instanceof TypeError) {
    return true;
  }

  // HTTP ステータスコードを含むエラーメッセージを解析
  const statusMatch = error.message.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    // 5xx → retryable
    if (status >= 500 && status <= 599) {
      return true;
    }
    // 4xx → NOT retryable
    if (status >= 400 && status <= 499) {
      return false;
    }
  }

  // その他のエラーはリトライ可能とみなす（ネットワーク系の可能性）
  return true;
}

/**
 * 指定された試行回数に基づいてリトライ遅延を計算する。
 * delay = baseDelayMs * 2^(attempt - 1)
 * attempt 1 → baseDelayMs, attempt 2 → baseDelayMs * 2
 */
export function calculateDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * Math.pow(2, attempt - 1);
}

/**
 * 指定時間スリープする。AbortSignal が発火した場合は即座に解決する。
 * @returns true: スリープ完了、false: abort により中断
 */
export function abortableSleep(
  ms: number,
  signal?: AbortSignal,
): Promise<boolean> {
  // signal が既に abort 済みの場合は即座に false を返す
  if (signal?.aborted) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (onAbort && signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      resolve(true);
    }, ms);

    if (signal) {
      onAbort = () => {
        cleanup();
        resolve(false);
      };
      signal.addEventListener("abort", onAbort);
    }
  });
}

/**
 * 非同期関数を指数バックオフ付きでリトライする。
 * - ネットワークエラーと 5xx レスポンスでリトライ
 * - 4xx レスポンスではリトライしない
 * - AbortSignal によるキャンセルに対応
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
): Promise<RetryResult<T>> {
  const { maxRetries, baseDelayMs, signal } = config;
  let attempts = 0;

  while (true) {
    attempts++;

    // AbortSignal チェック
    if (signal?.aborted) {
      return {
        success: false,
        error: new Error("Aborted"),
        attempts,
      };
    }

    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      // AbortError は即座に失敗を返す
      if (error.name === "AbortError") {
        return {
          success: false,
          error,
          attempts,
        };
      }

      // リトライ不可能なエラーは即座に失敗を返す
      if (!isRetryableError(error)) {
        return {
          success: false,
          error,
          attempts,
        };
      }

      // リトライ上限に達した場合は失敗を返す
      if (attempts > maxRetries) {
        return {
          success: false,
          error,
          attempts,
        };
      }

      // 指数バックオフで待機
      const delay = calculateDelay(attempts, baseDelayMs);
      const sleptFully = await abortableSleep(delay, signal);

      // abort により中断された場合は失敗を返す
      if (!sleptFully) {
        return {
          success: false,
          error: new Error("Aborted during retry wait"),
          attempts,
        };
      }
    }
  }
}
