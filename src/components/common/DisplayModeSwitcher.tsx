"use client";

import type { ReactNode } from "react";
import type { DisplayMode } from "@/src/types";
import styles from "./DisplayModeSwitcher.module.css";

export interface DisplayModeSwitcherProps {
  /** 現在選択中の表示モード */
  currentMode: DisplayMode;
  /** 表示モード変更時のハンドラ */
  onModeChange: (mode: DisplayMode) => void;
}

/** 各モードの定義（ラベル + アイコン SVG） */
const MODE_OPTIONS: { mode: DisplayMode; label: string; icon: ReactNode }[] =
  [
    {
      mode: "list",
      label: "リスト",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={16}
          height={16}
          aria-hidden="true"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      mode: "grid",
      label: "グリッド",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={16}
          height={16}
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      mode: "compact",
      label: "コンパクト",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={16}
          height={16}
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      ),
    },
  ];

/**
 * 表示モード切替ボタングループ。
 *
 * - Requirements 5.1: Bookmark 一覧の上部にリスト・グリッド・コンパクトの 3 つの表示モード切替ボタンを表示する
 *
 * 各ボタンは `aria-pressed` で選択状態をスクリーンリーダーに伝達する。
 */
export function DisplayModeSwitcher({
  currentMode,
  onModeChange,
}: DisplayModeSwitcherProps) {
  return (
    <div className={styles.switcher} role="group" aria-label="表示モード切替">
      {MODE_OPTIONS.map(({ mode, label, icon }) => {
        const isActive = currentMode === mode;
        return (
          <button
            key={mode}
            type="button"
            className={`${styles.button} ${isActive ? styles.active : ""}`}
            aria-pressed={isActive}
            onClick={() => onModeChange(mode)}
            title={label}
          >
            {icon}
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default DisplayModeSwitcher;
