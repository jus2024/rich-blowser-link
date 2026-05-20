"use client";

import { useState } from "react";
import { getFaviconUrl } from "@/src/lib/faviconUtils";
import styles from "./Favicon.module.css";

export interface FaviconProps {
  /** ファビコンを取得する対象の URL */
  url: string;
  /** アイコンのサイズ（px）。デフォルト 16 */
  size?: number;
}

/**
 * ファビコン表示コンポーネント。
 *
 * - Requirements 9.1: URL からドメインを抽出し Google Favicon API でファビコンを表示
 * - Requirements 9.2: すべての表示モードで使用可能
 * - Requirements 9.3: 画像ロードエラー時はデフォルトのグローブアイコンにフォールバック
 *
 * `getFaviconUrl` が空文字列を返す場合（不正な URL）は即座にフォールバックを表示する。
 */
export function Favicon({ url, size = 16 }: FaviconProps) {
  const faviconUrl = getFaviconUrl(url);
  const [hasError, setHasError] = useState(false);

  if (!faviconUrl || hasError) {
    return (
      <span
        className={styles.fallback}
        style={{ width: size, height: size, fontSize: size * 0.75 }}
        aria-label="デフォルトアイコン"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={size}
          height={size}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt="favicon"
      width={size}
      height={size}
      className={styles.favicon}
      onError={() => setHasError(true)}
    />
  );
}

export default Favicon;
