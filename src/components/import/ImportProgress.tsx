"use client";

import type { ImportProgress as ImportProgressType } from "@/src/lib/import/types";
import styles from "./ImportProgress.module.css";

export interface ImportProgressProps {
  progress: ImportProgressType;
  onCancel: () => void;
}

/**
 * インポート処理中の進捗を表示するコンポーネント。
 *
 * - Requirements 10.5: バッチ単位での進捗表示（処理済み/全件数、バッチ番号）
 * - Requirements 10.6: プログレスバーと推定残り時間の表示、キャンセル操作
 */
export function ImportProgress({ progress, onCancel }: ImportProgressProps) {
  const {
    status,
    processedCount,
    totalCount,
    percentage,
    estimatedRemainingSeconds,
    currentBatch,
    totalBatches,
  } = progress;

  // percentage は型上 0-100 を想定。念のためクランプして表示崩れを防ぐ。
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const remainingLabel =
    estimatedRemainingSeconds === null
      ? "—"
      : `残り約 ${Math.max(0, Math.round(estimatedRemainingSeconds))}s`;

  const isCompleted = status === "completed";

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label="インポート進捗"
    >
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuenow={clampedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={styles.progressBarFill}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span>処理済み</span>
          <strong>
            {processedCount} / {totalCount}
          </strong>
        </div>
        <div className={styles.statItem}>
          <span>進捗</span>
          <strong>{clampedPercentage.toFixed(0)}%</strong>
        </div>
        <div className={styles.statItem}>
          <span>バッチ</span>
          <strong>
            {currentBatch} / {totalBatches}
          </strong>
        </div>
        <div className={styles.statItem}>
          <span>残り時間</span>
          <strong>{remainingLabel}</strong>
        </div>
      </div>

      {!isCompleted && (
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
        >
          キャンセル
        </button>
      )}
    </div>
  );
}

export default ImportProgress;
