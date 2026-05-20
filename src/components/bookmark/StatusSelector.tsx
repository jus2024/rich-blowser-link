"use client";

import type { BookmarkStatus } from "@/src/types";
import styles from "./StatusSelector.module.css";

export interface StatusSelectorProps {
  /** 現在のステータス */
  currentStatus: BookmarkStatus;
  /** ステータス変更時のコールバック */
  onStatusChange: (status: BookmarkStatus) => void;
}

/** ステータス選択肢の定義 */
const STATUS_OPTIONS: { value: BookmarkStatus; label: string }[] = [
  { value: "inbox", label: "あとで読む" },
  { value: "read", label: "既読" },
  { value: "archived", label: "アーカイブ" },
];

/**
 * Bookmark のステータスを変更するセレクター。
 *
 * inbox・read・archived の 3 つの選択肢を表示し、
 * ユーザーが選択すると `onStatusChange` を呼び出す。
 *
 * Requirements 10.2: ステータス変更アクション選択時に inbox・read・archived の選択肢を表示する
 */
export function StatusSelector({
  currentStatus,
  onStatusChange,
}: StatusSelectorProps) {
  return (
    <select
      className={styles.select}
      value={currentStatus}
      onChange={(e) => onStatusChange(e.target.value as BookmarkStatus)}
      aria-label="ステータスを変更"
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default StatusSelector;
