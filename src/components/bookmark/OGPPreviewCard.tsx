"use client";

import type { Bookmark } from "@/src/types";
import { getDisplayTitle, shouldShowDescription } from "@/src/lib/ogpUtils";
import styles from "./OGPPreviewCard.module.css";

export interface OGPPreviewCardProps {
  /** プレビュー対象の Bookmark */
  bookmark: Bookmark;
  /** 表示フラグ。false の場合は何もレンダリングしない。 */
  visible: boolean;
  /** ビューポート境界を考慮した表示位置。指定時は fixed ポジショニングを使用する。 */
  position?: { top: number; left: number };
}

/** 説明文のプレビュー表示上限（Requirements 7.2） */
const DESCRIPTION_PREVIEW_LIMIT = 120;

/**
 * 説明文をプレビュー表示用に整形する。
 *
 * - DESCRIPTION_PREVIEW_LIMIT を超える場合は末尾に「…」を付与して切り詰める
 * - DESCRIPTION_PREVIEW_LIMIT 以下の場合はそのまま返す
 *
 * `shouldShowDescription` で true と判定された前提（呼び出し側で事前チェック）。
 */
function buildDescriptionPreview(description: string): string {
  if (description.length > DESCRIPTION_PREVIEW_LIMIT) {
    return `${description.slice(0, DESCRIPTION_PREVIEW_LIMIT)}…`;
  }
  return description;
}

/**
 * Bookmark のホバー時に表示される OGP プレビューカード。
 *
 * - Requirements 4.1: BookmarkCard に 200ms 以上ホバーが継続した後に呼び出し側から
 *   `visible=true` が渡されるとプレビューカードを表示する。表示タイミング（200ms）
 *   の制御は呼び出し側（BookmarkCard）に委譲する。
 * - Requirements 4.5: OGP 画像が無い場合はプレースホルダー表示（リンクアイコン付き
 *   グレーボックス）に差し替える。
 * - Requirements 4.2: `visible=false` が渡された場合はカードを非表示にする
 *   （`null` を返してアンマウント）。
 * - Requirements 4.6: `position` が渡された場合は fixed ポジショニングを使用し、
 *   ビューポート境界を考慮した位置に表示する。
 * - タイトル欠落時は URL をタイトルとして表示し、説明欠落時は
 *   説明段落そのものを非表示にする。判定は {@link getDisplayTitle} と
 *   {@link shouldShowDescription} に委譲する。
 */
export function OGPPreviewCard({ bookmark, visible, position }: OGPPreviewCardProps) {
  if (!visible) {
    return null;
  }

  const title = getDisplayTitle(bookmark);
  const showDescription = shouldShowDescription(bookmark);
  const hasImage =
    typeof bookmark.ogpImageUrl === "string" &&
    bookmark.ogpImageUrl.trim().length > 0;

  const positionStyle: React.CSSProperties | undefined = position
    ? {
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
      }
    : undefined;

  return (
    <div
      className={`${styles.card}${position ? ` ${styles.cardFixed}` : ""}`}
      role="tooltip"
      aria-label="OGP プレビュー"
      style={positionStyle}
    >
      <div className={styles.imageWrapper}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bookmark.ogpImageUrl}
            alt=""
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <span className={styles.placeholder} aria-label="画像プレースホルダー">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>画像なし</span>
          </span>
        )}
      </div>

      <p className={styles.title}>{title}</p>

      {showDescription && (
        <p className={styles.description}>
          {buildDescriptionPreview(bookmark.description)}
        </p>
      )}
    </div>
  );
}

export default OGPPreviewCard;
