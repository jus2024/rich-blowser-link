"use client";

import type { BookmarkStatus } from "@/src/types";
import styles from "./StatusBadge.module.css";

export interface StatusBadgeProps {
  status: BookmarkStatus;
}

/** ステータスに対応する表示ラベル */
const STATUS_LABELS: Record<BookmarkStatus, string> = {
  inbox: "あとで読む",
  read: "既読",
  archived: "アーカイブ",
};

/**
 * Bookmark のステータスに応じたバッジを表示するコンポーネント。
 *
 * - inbox: 青（primary）
 * - read: 緑（success）
 * - archived: グレー（muted）
 *
 * Requirements 10.5: 各 Bookmark カードにステータスを示すバッジを表示する
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[status]}`}
      aria-label={`ステータス: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default StatusBadge;
