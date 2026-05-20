"use client";

/**
 * useDisplayMode フック
 *
 * 表示モード（list / grid / compact）の状態管理と localStorage 永続化を提供する。
 *
 * 振る舞い:
 * - 初期化時に localStorage から保存済みの表示モードを読み込む
 * - 読み込み失敗または無効な値の場合は "list" にフォールバックする
 * - モード変更時に localStorage へ保存する
 * - localStorage 書き込み失敗時（プライベートブラウジング等）はエラーを無視する
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 */

import { useCallback, useState } from "react";
import type { DisplayMode } from "@/src/types";

/** localStorage に保存する際のキー */
const STORAGE_KEY = "displayMode";

/** 有効な表示モード値 */
const VALID_MODES: readonly DisplayMode[] = ["list", "grid", "compact"];

/** デフォルトの表示モード */
const DEFAULT_MODE: DisplayMode = "list";

export interface UseDisplayModeReturn {
  /** 現在の表示モード */
  displayMode: DisplayMode;
  /** 表示モードを変更する（localStorage にも保存） */
  setDisplayMode: (mode: DisplayMode) => void;
}

/**
 * localStorage から表示モードを読み込む。
 * 読み込み失敗または無効な値の場合は DEFAULT_MODE を返す。
 */
function readDisplayMode(): DisplayMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored as DisplayMode)) {
      return stored as DisplayMode;
    }
  } catch {
    // localStorage アクセス失敗時はフォールバック
  }
  return DEFAULT_MODE;
}

/**
 * localStorage に表示モードを保存する。
 * 書き込み失敗時はエラーを無視する。
 */
function writeDisplayMode(mode: DisplayMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // プライベートブラウジング等で書き込み失敗時は無視
  }
}

/**
 * 表示モード（list / grid / compact）の状態管理と localStorage 永続化を行う
 * カスタムフック。
 */
export function useDisplayMode(): UseDisplayModeReturn {
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(readDisplayMode);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    writeDisplayMode(mode);
  }, []);

  return { displayMode, setDisplayMode };
}
