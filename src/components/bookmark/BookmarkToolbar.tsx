"use client";

import type { DisplayMode, SortKey } from "@/src/types";
import { DisplayModeSwitcher } from "@/src/components/common/DisplayModeSwitcher";
import { SortSelector } from "@/src/components/common/SortSelector";
import styles from "./BookmarkToolbar.module.css";

export interface BookmarkToolbarProps {
  /** 現在の表示モード */
  displayMode: DisplayMode;
  /** 表示モード変更時のハンドラ */
  onDisplayModeChange: (mode: DisplayMode) => void;
  /** 現在のソートキー */
  sortKey: SortKey;
  /** ソート条件変更時のハンドラ */
  onSortChange: (sort: SortKey) => void;
}

/**
 * Bookmark ツールバー。
 *
 * DisplayModeSwitcher と SortSelector を水平に配置し、
 * Bookmark 一覧の上部に表示する操作バーとして機能する。
 *
 * - Requirements 5.1: 表示モード切替ボタンを表示する
 * - Requirements 13.1: ソート条件選択 UI を表示する
 */
export function BookmarkToolbar({
  displayMode,
  onDisplayModeChange,
  sortKey,
  onSortChange,
}: BookmarkToolbarProps) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Bookmark ツールバー">
      <DisplayModeSwitcher
        currentMode={displayMode}
        onModeChange={onDisplayModeChange}
      />
      <SortSelector currentSort={sortKey} onSortChange={onSortChange} />
    </div>
  );
}

export default BookmarkToolbar;
