"use client";

import type { EnrichmentQueueProgress } from "@/src/lib/ai/enrichmentQueue";
import styles from "./EnrichmentProgressBar.module.css";

interface EnrichmentProgressBarProps {
  progress: EnrichmentQueueProgress | null;
}

/**
 * AI 補完バッチ処理の進捗バー。
 * isProcessing が false または progress が null の場合は非表示。
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
export function EnrichmentProgressBar({ progress }: EnrichmentProgressBarProps) {
  if (!progress || !progress.isProcessing) return null;

  const percentage =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div
      className={styles.enrichmentProgress}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="AI 補完進捗"
    >
      <div className={styles.progressBar} style={{ width: `${percentage}%` }} />
      <span className={styles.progressText}>
        AI 補完中: {progress.completed}/{progress.total}
        {progress.failed > 0 && ` (${progress.failed} 件失敗)`}
      </span>
    </div>
  );
}
