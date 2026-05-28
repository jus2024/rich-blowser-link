"use client";

import { useEffect, useRef, useState } from "react";
import type { EnrichmentQueueProgress } from "@/src/lib/ai/enrichmentQueue";
import styles from "./PipelineProgress.module.css";

/** OGP フェッチキューの進捗情報 */
export interface OGPFetchQueueProgress {
  total: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

export interface PipelineProgressProps {
  ogpProgress: OGPFetchQueueProgress | null;
  enrichmentProgress: EnrichmentQueueProgress | null;
}

/** 完了後の表示維持時間（ミリ秒） */
const COMPLETION_DISPLAY_DELAY_MS = 3000;

/**
 * 統合パイプライン進捗表示コンポーネント。
 * - OGP フェッチ進捗をアクティブ時に表示
 * - AI 補完進捗をアクティブ時に表示
 * - 両方アクティブ時は同時表示
 * - 失敗アイテム数を表示
 * - 全ステージ完了後 3 秒間表示を維持してから非表示
 * - いずれかのステージに pending/in-flight アイテムがある限り表示を維持
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export function PipelineProgress({
  ogpProgress,
  enrichmentProgress,
}: PipelineProgressProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActiveRef = useRef(false);

  const ogpActive = ogpProgress !== null && ogpProgress.isProcessing;
  const enrichmentActive =
    enrichmentProgress !== null && enrichmentProgress.isProcessing;
  const anyActive = ogpActive || enrichmentActive;

  useEffect(() => {
    if (anyActive) {
      // ステージがアクティブになったら表示し、タイマーをクリア
      wasActiveRef.current = true;
      setVisible(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else if (wasActiveRef.current) {
      // 全ステージ完了 → 3 秒後に非表示
      timerRef.current = setTimeout(() => {
        setVisible(false);
        wasActiveRef.current = false;
        timerRef.current = null;
      }, COMPLETION_DISPLAY_DELAY_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [anyActive]);

  if (!visible) return null;

  const ogpPercentage =
    ogpProgress && ogpProgress.total > 0
      ? Math.round((ogpProgress.completed / ogpProgress.total) * 100)
      : 0;

  const enrichmentPercentage =
    enrichmentProgress && enrichmentProgress.total > 0
      ? Math.round(
          (enrichmentProgress.completed / enrichmentProgress.total) * 100,
        )
      : 0;

  return (
    <div className={styles.container}>
      {ogpProgress && ogpProgress.total > 0 && (
        <div
          className={styles.progressSection}
          role="progressbar"
          aria-valuenow={ogpPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="OGP フェッチ進捗"
        >
          <div
            className={styles.progressBar}
            style={{ width: `${ogpPercentage}%` }}
          />
          <span className={styles.progressText}>
            OGP 取得中: {ogpProgress.completed}/{ogpProgress.total}
            {ogpProgress.failed > 0 && (
              <span className={styles.failedText}>
                {" "}
                ({ogpProgress.failed} 件失敗)
              </span>
            )}
          </span>
        </div>
      )}

      {enrichmentProgress && enrichmentProgress.total > 0 && (
        <div
          className={styles.progressSection}
          role="progressbar"
          aria-valuenow={enrichmentPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="AI 補完進捗"
        >
          <div
            className={styles.progressBar}
            style={{ width: `${enrichmentPercentage}%` }}
          />
          <span className={styles.progressText}>
            AI 補完中: {enrichmentProgress.completed}/{enrichmentProgress.total}
            {enrichmentProgress.failed > 0 && (
              <span className={styles.failedText}>
                {" "}
                ({enrichmentProgress.failed} 件失敗)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
