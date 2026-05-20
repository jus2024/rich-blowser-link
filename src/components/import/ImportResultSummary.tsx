"use client";

import type { ImportResult } from "@/src/lib/import/types";
import styles from "./ImportResultSummary.module.css";

export interface ImportResultSummaryProps {
  result: ImportResult;
  onClose: () => void;
}

/**
 * インポート完了時に表示する結果サマリー。
 *
 * - 成功件数 / スキップ件数 / 失敗件数 / 作成 Collection 数 / 処理時間を表示する
 * - 失敗 URL がある場合は折りたたみセクションで一覧表示する
 *
 * Validates: Requirements 10.11, 10.12
 */
export function ImportResultSummary({
  result,
  onClose,
}: ImportResultSummaryProps) {
  const {
    successCount,
    skippedCount,
    failedCount,
    createdCollections,
    failedUrls,
    duration,
  } = result;

  const durationSecondsLabel = `${(duration / 1000).toFixed(1)}秒`;

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label="インポート完了サマリー"
    >
      <h2 className={styles.title}>インポート完了</h2>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>成功</span>
          <span className={styles.statValue}>{successCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>スキップ</span>
          <span className={styles.statValue}>{skippedCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>失敗</span>
          <span className={styles.statValue}>{failedCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>作成された Collection</span>
          <span className={styles.statValue}>{createdCollections}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>処理時間</span>
          <span className={styles.statValue}>{durationSecondsLabel}</span>
        </div>
      </div>

      {failedUrls.length > 0 && (
        <details className={styles.failedSection}>
          <summary>失敗した URL ({failedUrls.length}件)</summary>
          <ul className={styles.failedList}>
            {failedUrls.map((url, index) => (
              <li key={`${url}-${index}`} className={styles.failedUrl}>
                {url}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

export default ImportResultSummary;
