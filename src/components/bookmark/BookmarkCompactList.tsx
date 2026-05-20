"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bookmark } from "@/src/types";
import { Favicon } from "@/src/components/common/Favicon";
import { getDisplayTitle } from "@/src/lib/ogpUtils";
import { calculatePreviewPositionFromMouse } from "@/src/lib/previewPositionUtils";
import { OGPPreviewCard } from "./OGPPreviewCard";
import styles from "./BookmarkCompactList.module.css";

export interface BookmarkCompactListProps {
  /** 表示対象の Bookmark 一覧 */
  bookmarks: Bookmark[];
  /** 編集ボタンのハンドラ。Bookmark ID を受け取る。 */
  onEdit: (id: string) => void;
  /** 削除ボタンのハンドラ。Bookmark ID を受け取る。 */
  onDelete: (id: string) => void;
  /** リンククリックのハンドラ。Bookmark ID を受け取り、新しいタブでリンク先を開く。 */
  onLinkClick: (id: string) => void;
}

/**
 * コンパクト表示コンポーネント。
 *
 * - Requirements 7.1: ファビコン、タイトル、URL のみの 1 行形式で表示
 * - Requirements 7.2: OGP 画像と説明を非表示にし、行間を最小限に抑える
 * - Requirements 7.3: 各行にホバー時のみ編集・削除アクションを表示
 */
export function BookmarkCompactList({
  bookmarks,
  onEdit,
  onDelete,
  onLinkClick,
}: BookmarkCompactListProps) {
  if (bookmarks.length === 0) {
    return (
      <div className={styles.empty}>
        <p>ブックマークがありません</p>
      </div>
    );
  }

  return (
    <ul className={styles.list} aria-label="ブックマーク一覧（コンパクト表示）">
      {bookmarks.map((bookmark) => (
        <CompactRow
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={onEdit}
          onDelete={onDelete}
          onLinkClick={onLinkClick}
        />
      ))}
    </ul>
  );
}

function CompactRow({
  bookmark,
  onEdit,
  onDelete,
  onLinkClick,
}: {
  bookmark: Bookmark;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkClick: (id: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLLIElement | null>(null);

  const displayTitle = getDisplayTitle(bookmark);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    hoverTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        setPreviewPosition(calculatePreviewPositionFromMouse(mouseX, mouseY, { width: 360, height: 240 }, viewport));
      }
      setShowPreview(true);
      hoverTimerRef.current = null;
    }, 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setShowPreview(false);
    setPreviewPosition(null);
  }, []);

  const handleLinkClick = () => {
    onLinkClick(bookmark.id);
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  return (
    <li
      ref={rowRef}
      className={styles.row}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={styles.favicon}>
        <Favicon url={bookmark.url} size={16} />
      </span>

      <button
        type="button"
        className={styles.title}
        title={displayTitle}
        onClick={handleLinkClick}
      >
        {displayTitle}
      </button>

      <span className={styles.url} title={bookmark.url}>
        {bookmark.url}
      </span>

      <span className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => onEdit(bookmark.id)}
          aria-label={`${displayTitle} を編集`}
        >
          編集
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.deleteButton}`}
          onClick={() => onDelete(bookmark.id)}
          aria-label={`${displayTitle} を削除`}
        >
          削除
        </button>
      </span>

      <OGPPreviewCard
        bookmark={bookmark}
        visible={showPreview}
        position={previewPosition ?? undefined}
      />
    </li>
  );
}

export default BookmarkCompactList;
