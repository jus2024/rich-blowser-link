"use client";

import type { SortKey } from "@/src/types";
import styles from "./SortSelector.module.css";

export interface SortSelectorProps {
  /** 現在選択中のソートキー */
  currentSort: SortKey;
  /** ソート条件変更時のコールバック */
  onSortChange: (sort: SortKey) => void;
}

/** ソート条件の表示ラベル */
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "createdAt", label: "作成日時" },
  { value: "lastAccessedAt", label: "最終アクセス日時" },
  { value: "accessCount", label: "アクセス回数" },
];

/**
 * ソート条件選択コンポーネント。
 *
 * Bookmark 一覧のソート条件（作成日時・最終アクセス日時・アクセス回数）を
 * ドロップダウンで選択可能にする。
 *
 * - Requirements 13.1: ソート条件選択 UI を表示する
 */
export function SortSelector({ currentSort, onSortChange }: SortSelectorProps) {
  return (
    <div className={styles.container}>
      <label htmlFor="sort-selector" className={styles.label}>
        並び替え
      </label>
      <select
        id="sort-selector"
        className={styles.select}
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
        aria-label="ソート条件を選択"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SortSelector;
