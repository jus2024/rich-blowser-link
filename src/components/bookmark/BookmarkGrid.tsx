"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bookmark, BookmarkStatus, Tag } from "@/src/types";
import { getDisplayTitle } from "@/src/lib/ogpUtils";
import { isRecentlyAccessed } from "@/src/lib/recentAccessUtils";
import { calculatePreviewPositionFromMouse } from "@/src/lib/previewPositionUtils";
import { Favicon } from "@/src/components/common/Favicon";
import { OGPPreviewCard } from "./OGPPreviewCard";
import { StatusBadge } from "./StatusBadge";
import { StatusSelector } from "./StatusSelector";
import styles from "./BookmarkGrid.module.css";

export interface BookmarkGridProps {
  bookmarks: Bookmark[];
  tagsByBookmarkId?: Record<string, string[]>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkClick: (id: string) => void;
  onStatusChange: (id: string, status: BookmarkStatus) => void;
  onAssignCollection: (bookmarkId: string) => void;
  onToggleReadable: (id: string) => void;
  onTogglePin: (id: string) => void;
  allTags?: Tag[];
  onAddTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  onRemoveTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  onCreateTag?: (name: string) => Promise<Tag>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}
export function BookmarkGrid({
  bookmarks,
  tagsByBookmarkId,
  onEdit,
  onDelete,
  onLinkClick,
  onStatusChange,
  onAssignCollection,
  onToggleReadable,
  onTogglePin,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  selectedIds,
  onToggleSelect,
}: BookmarkGridProps) {
  return (
    <div className={styles.grid} role="list" aria-label="ブックマーク一覧（グリッド）">
      {bookmarks.map((bookmark) => (
        <GridCard
          key={bookmark.id}
          bookmark={bookmark}
          tags={tagsByBookmarkId?.[bookmark.id] ?? []}
          allTags={allTags}
          onEdit={onEdit}
          onDelete={onDelete}
          onLinkClick={onLinkClick}
          onStatusChange={onStatusChange}
          onAssignCollection={onAssignCollection}
          onToggleReadable={onToggleReadable}
          onTogglePin={onTogglePin}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
          isSelected={selectedIds?.has(bookmark.id) ?? false}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

function GridCard({
  bookmark,
  tags,
  allTags,
  onEdit,
  onDelete,
  onLinkClick,
  onStatusChange,
  onAssignCollection,
  onToggleReadable,
  onTogglePin,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  isSelected,
  onToggleSelect,
}: {
  bookmark: Bookmark;
  tags: string[];
  allTags?: Tag[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkClick: (id: string) => void;
  onStatusChange: (id: string, status: BookmarkStatus) => void;
  onAssignCollection: (bookmarkId: string) => void;
  onToggleReadable: (id: string) => void;
  onTogglePin: (id: string) => void;
  onAddTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  onRemoveTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  onCreateTag?: (name: string) => Promise<Tag>;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);

  const displayTitle = getDisplayTitle(bookmark);
  const hasOgpImage = typeof bookmark.ogpImageUrl === "string" && bookmark.ogpImageUrl.trim().length > 0;
  const recentlyAccessed = isRecentlyAccessed(bookmark.lastAccessedAt);

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

  const handleTagAdd = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !onAddTag) return;
    const existing = allTags?.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      await onAddTag(existing.id, bookmark.id);
    } else if (onCreateTag) {
      const newTag = await onCreateTag(trimmed);
      await onAddTag(newTag.id, bookmark.id);
    }
    setTagInput("");
    setShowTagInput(false);
  }, [allTags, bookmark.id, onAddTag, onCreateTag]);

  const handleTagRemove = useCallback(async (tagName: string) => {
    if (!onRemoveTag) return;
    const tag = allTags?.find((t) => t.name === tagName);
    if (!tag) return;
    await onRemoveTag(tag.id, bookmark.id);
  }, [allTags, bookmark.id, onRemoveTag]);

  return (
    <article
      ref={cardRef}
      className={[
        styles.card,
        recentlyAccessed ? styles.recentlyAccessed : "",
      ].filter(Boolean).join(" ")}
      role="listitem"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ピンバッジ */}
      {bookmark.pinned && <span className={styles.pinBadge}>📌</span>}

      {/* チェックボックス */}
      {onToggleSelect && (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleSelect(bookmark.id)}
          aria-label={`${displayTitle} を選択`}
        />
      )}

      {/* OGP画像エリア（大きく表示） */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.imageLink}
        onClick={() => onLinkClick(bookmark.id)}
      >
        <div className={styles.imageArea}>
          {hasOgpImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bookmark.ogpImageUrl} alt="" className={styles.ogpImage} loading="lazy" />
          ) : (
            <div className={styles.placeholder}>
              <Favicon url={bookmark.url} size={48} />
            </div>
          )}
        </div>
      </a>

      {/* カード本文 */}
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Favicon url={bookmark.url} size={14} />
          <h3 className={styles.title} title={displayTitle}>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.titleLink}
              onClick={() => onLinkClick(bookmark.id)}
            >
              {displayTitle}
            </a>
          </h3>
        </div>

        {/* タグ */}
        <div className={styles.tagArea}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tagBadge}>
              {tag}
              {onRemoveTag && (
                <button type="button" className={styles.tagRemove} onClick={() => void handleTagRemove(tag)}>×</button>
              )}
            </span>
          ))}
          {onAddTag && !showTagInput && (
            <button type="button" className={styles.tagAdd} onClick={() => setShowTagInput(true)}>+</button>
          )}
        </div>
        {showTagInput && (
          <div className={styles.tagInputRow}>
            <input
              type="text"
              className={styles.tagInput}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void handleTagAdd(tagInput); }
                if (e.key === "Escape") { setShowTagInput(false); setTagInput(""); }
              }}
              placeholder="タグ名..."
              autoFocus
            />
            <button type="button" className={styles.tagInputCancel} onClick={() => { setShowTagInput(false); setTagInput(""); }}>×</button>
          </div>
        )}

        {/* 読み物系ステータス */}
        {bookmark.isReadable && (
          <div className={styles.statusRow}>
            <StatusBadge status={bookmark.status} />
            <StatusSelector
              currentStatus={bookmark.status}
              onStatusChange={(status) => onStatusChange(bookmark.id, status)}
            />
          </div>
        )}
      </div>

      {/* アクションバー（アイコンボタン） */}
      <div className={styles.actionBar}>
        <button
          type="button"
          className={[styles.iconBtn, bookmark.pinned ? styles.iconBtnActive : ""].filter(Boolean).join(" ")}
          onClick={() => onTogglePin(bookmark.id)}
          title={bookmark.pinned ? "ピン解除" : "ピン留め"}
        >
          📍
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => onAssignCollection(bookmark.id)}
          title="振り分け"
        >
          📂
        </button>
        <button
          type="button"
          className={[styles.iconBtn, bookmark.isReadable ? styles.iconBtnActive : ""].filter(Boolean).join(" ")}
          onClick={() => onToggleReadable(bookmark.id)}
          title={bookmark.isReadable ? "読み物解除" : "読み物"}
        >
          📖
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => onEdit(bookmark.id)}
          title="編集"
        >
          ✏️
        </button>
        <button
          type="button"
          className={[styles.iconBtn, styles.iconBtnDanger].join(" ")}
          onClick={() => onDelete(bookmark.id)}
          title="削除"
        >
          🗑️
        </button>
      </div>

      <OGPPreviewCard
        bookmark={bookmark}
        visible={showPreview}
        position={previewPosition ?? undefined}
      />
    </article>
  );
}

export default BookmarkGrid;
