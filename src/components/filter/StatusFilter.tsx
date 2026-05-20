"use client";

import type { BookmarkStatus } from "@/src/types";
import styles from "./StatusFilter.module.css";

export interface StatusFilterProps {
  /** 現在選択中のステータス（null = フィルターなし） */
  selectedStatus: BookmarkStatus | null;
  /** ステータス選択変更時のコールバック */
  onStatusChange: (status: BookmarkStatus | null) => void;
  /** 各ステータスの Bookmark 件数 */
  counts: Record<BookmarkStatus, number>;
}

const STATUS_OPTIONS: { value: BookmarkStatus | null; label: string }[] = [
  { value: null, label: "すべて" },
  { value: "inbox", label: "あとで読む" },
  { value: "read", label: "既読" },
  { value: "archived", label: "アーカイブ" },
];

/**
 * ステータスフィルターセクション。
 *
 * - 要件 11.1: サイドバーにステータスフィルターセクションを表示する。
 * - 要件 11.4: 各ステータスフィルター項目に該当する Bookmark 件数を表示する。
 * - 選択済みのフィルターを再クリックすると選択解除（null に戻す）。
 */
export function StatusFilter({
  selectedStatus,
  onStatusChange,
  counts,
}: StatusFilterProps) {
  const totalCount = counts.inbox + counts.read + counts.archived;

  const handleClick = (value: BookmarkStatus | null) => {
    if (value === selectedStatus) {
      // 選択済みを再クリックで解除
      onStatusChange(null);
    } else {
      onStatusChange(value);
    }
  };

  return (
    <aside className={styles.sidebar} aria-label="ステータスフィルター">
      <div className={styles.header}>
        <h2 className={styles.title}>読み物系</h2>
      </div>

      <ul className={styles.list}>
        {STATUS_OPTIONS.map((option) => {
          const isSelected = option.value === selectedStatus;
          const count =
            option.value === null ? totalCount : counts[option.value];

          return (
            <li key={option.value ?? "all"}>
              <button
                type="button"
                className={
                  isSelected
                    ? `${styles.statusItem} ${styles.statusItemSelected}`
                    : styles.statusItem
                }
                onClick={() => handleClick(option.value)}
                aria-pressed={isSelected}
              >
                <span className={styles.statusName}>{option.label}</span>
                <span className={styles.count}>({count})</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default StatusFilter;
