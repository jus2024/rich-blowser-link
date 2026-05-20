"use client";

/**
 * useAIEnrichment フック
 *
 * AI 補完機能のオン/オフ状態管理と localStorage 永続化を提供する。
 *
 * 振る舞い:
 * - デフォルト値は true（ON）
 * - SSR 対応: 初期値は true、クライアントサイドで localStorage から復元する
 * - state 変更時に即座に localStorage に書き込む
 * - localStorage 書き込み失敗時（プライベートブラウジング等）はエラーを無視する
 *
 * Validates: Requirements 9.4, 9.5, 9.7
 */

import { useCallback, useEffect, useState } from "react";

/** localStorage に保存する際のキー */
const STORAGE_KEY = "ai-enrichment-enabled";

/** デフォルト値（ON） */
const DEFAULT_VALUE = true;

export interface UseAIEnrichmentReturn {
  /** AI 補完が有効かどうか */
  isAIEnabled: boolean;
  /** AI 補完の有効/無効を切り替える（localStorage にも保存） */
  setAIEnabled: (enabled: boolean) => void;
}

/**
 * AI 補完機能のオン/オフ状態管理と localStorage 永続化を行うカスタムフック。
 *
 * SSR 対応のため、初期値は true とし、useEffect でクライアントサイドの
 * localStorage から保存済みの値を復元する。
 */
export function useAIEnrichment(): UseAIEnrichmentReturn {
  const [isAIEnabled, setIsAIEnabled] = useState<boolean>(DEFAULT_VALUE);

  // クライアントサイドで localStorage から復元する
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsAIEnabled(stored === "true");
      }
    } catch {
      // localStorage アクセス失敗時はデフォルト値のまま
    }
  }, []);

  const setAIEnabled = useCallback((enabled: boolean) => {
    setIsAIEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // プライベートブラウジング等で書き込み失敗時は無視
    }
  }, []);

  return { isAIEnabled, setAIEnabled };
}
