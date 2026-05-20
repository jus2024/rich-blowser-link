"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bookmark, BookmarkStatus } from "@/src/types";
import { getDisplayTitle } from "@/src/lib/ogpUtils";
import { isRecentlyAccessed } from "@/src/lib/recentAccessUtils";
import { calculatePreviewPositionFromMouse } from "@/src/lib/previewPositionUtils";
import { OGPPreviewCard } from "./OGPPreviewCard";
import { Favicon } from "@/src/components/common/Favicon";
import { StatusBadge } from "./StatusBadge";
import { StatusSelector } from "./StatusSelector";
import styles from "./BookmarkCard.module.css";

export interface BookmarkCardProps {
  bookmark: Bookmark;
  tags?: string[];
  /** 全タグ一覧（カード上でのタグ追加候補に使用） */
  allTags?: import("@/src/types").Tag[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkClick: (id: string) => void;
  onStatusChange: (id: string, status: BookmarkStatus) => void;
  onAssignCollection: (bookmarkId: string) => void;
  onToggleReadable: (id: string) => void;
  onTogglePin: (id: string) => void;
  /** タグを追加するハンドラ（tagId, bookmarkId） */
  onAddTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  /** タグを削除するハンドラ（tagId, bookmarkId） */
  onRemoveTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  /** タグを新規作成するハンドラ */
  onCreateTag?: (name: string) => Promise<import("@/src/types").Tag>;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}

/** OGP プレビュー表示までのホバー継続時間（ミリ秒）。Requirements 7.2 */
const PREVIEW_HOVER_DELAY_MS = 200;

/**
 * OGP プレビューカードの想定サイズ（px）。
 * Requirements 4.6: ビューポート境界判定に使用する目安サイズ。実際のサイズは
 * {@link OGPPreviewCard.module.css} の `.card` ルール（width: min(360px, 100%)）と
 * 内容量に依存する。若干小さめに見積もっても反対側への切替挙動は成立する。
 */
const PREVIEW_CARD_SIZE = { width: 360, height: 240 } as const;

/**
 * Bookmark 一覧に表示する単一カードコンポーネント。
 *
 * - Requirements 2.2: タイトル・URL・OGP 画像サムネイル・Tag バッジ一覧を表示する
 * - Requirements 7.1: OGP 画像をサムネイルとして表示する
 * - Requirements 7.3: OGP 画像が存在しない場合はプレースホルダーを表示する
 * - Requirements 7.2 / 7.4: 200ms 以上ホバーが継続した場合に {@link OGPPreviewCard} を
 *   表示し、ホバーアウトまたは他要素のタップで非表示にする。表示可視状態の管理は
 *   本コンポーネント側で行い、OGPPreviewCard には `visible` フラグを渡す。
 *
 * タイトルは Bookmark の URL への外部リンクとしてレンダリングする
 * （`target="_blank"` + `rel="noopener noreferrer"` で安全に開く）。
 * タイトル文字列は {@link getDisplayTitle} を通じて OGP タイトル欠落時は URL に
 * フォールバックする（Requirements 7.5）。
 */
export function BookmarkCard({
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
  dragHandleProps,
}: BookmarkCardProps) {
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewPosition, setPreviewPosition] = useState<
    { top: number; left: number } | null
  >(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  /** ホバータイマーを解除する（解除のみ。プレビュー状態は変更しない） */
  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  // アンマウント時のタイマーリーク防止
  useEffect(() => {
    return () => {
      clearHoverTimer();
    };
  }, [clearHoverTimer]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    clearHoverTimer();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    hoverTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        setPreviewPosition(
          calculatePreviewPositionFromMouse(mouseX, mouseY, PREVIEW_CARD_SIZE, viewport),
        );
      } else {
        setPreviewPosition(null);
      }
      setShowPreview(true);
      hoverTimerRef.current = null;
    }, PREVIEW_HOVER_DELAY_MS);
  }, [clearHoverTimer]);

  const handleMouseLeave = useCallback(() => {
    clearHoverTimer();
    setShowPreview(false);
    setPreviewPosition(null);
  }, [clearHoverTimer]);

  const hasThumbnail =
    typeof bookmark.ogpImageUrl === "string" &&
    bookmark.ogpImageUrl.trim().length > 0;

  const displayTitle = getDisplayTitle(bookmark);
  const tagList = tags ?? [];
  const recentlyAccessed = isRecentlyAccessed(bookmark.lastAccessedAt);

  // タグ追加: 既存タグから選択 or 新規作成
  const handleTagAdd = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !onAddTag) return;
    // 既存タグを名前で検索（大文字小文字区別なし）
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

  // タグ削除: タグ名から tagId を解決して削除
  const handleTagRemove = useCallback(async (tagName: string) => {
    if (!onRemoveTag) return;
    const tag = allTags?.find((t) => t.name === tagName);
    if (!tag) return;
    await onRemoveTag(tag.id, bookmark.id);
  }, [allTags, bookmark.id, onRemoveTag]);

  // タグ入力のサジェスト（未付与のタグのみ）
  const tagSuggestions = allTags?.filter(
    (t) => !tagList.includes(t.name) &&
      (tagInput === "" || t.name.toLowerCase().includes(tagInput.toLowerCase()))
  ) ?? [];

  return (
    <article
      ref={cardRef}
      className={`${styles.card}${recentlyAccessed ? ` ${styles.recentlyAccessed}` : ""}${dragHandleProps ? ` ${styles.cardSortable}` : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {dragHandleProps && (
        <span
          className={styles.dragHandle}
          aria-label="ドラッグして並び替え"
          title="ドラッグして並び替え"
          {...dragHandleProps}
        >
          ⠿
        </span>
      )}
      {bookmark.pinned && (
        <span className={styles.pinBadge} aria-label="ピン留め中">
          📌
        </span>
      )}

      <div className={styles.thumbnail} aria-hidden="true">
        {hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bookmark.ogpImageUrl}
            alt=""
            className={styles.thumbnailImage}
            loading="lazy"
          />
        ) : (
          <span className={styles.thumbnailPlaceholder}>画像なし</span>
        )}
      </div>

      <div className={styles.body}>
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
        <span className={styles.urlRow}>
          <Favicon url={bookmark.url} size={16} />
          <span className={styles.url} title={bookmark.url}>
            {bookmark.url}
          </span>
        </span>

        {bookmark.description && (
          <p className={styles.description} title={bookmark.description}>
            {bookmark.description}
          </p>
        )}

        {bookmark.memo && (
          <p className={styles.memo} title={bookmark.memo}>
            {bookmark.memo}
          </p>
        )}

        {(tagList.length > 0 || onAddTag) && (
          <div className={styles.tagArea}>
            <ul className={styles.tags} aria-label="タグ一覧">
              {tagList.map((tag) => (
                <li key={tag} className={styles.tagBadge}>
                  {tag}
                  {onRemoveTag && (
                    <button
                      type="button"
                      className={styles.tagRemove}
                      onClick={() => handleTagRemove(tag)}
                      aria-label={`タグ「${tag}」を削除`}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
              {onAddTag && !showTagInput && (
                <li>
                  <button
                    type="button"
                    className={styles.tagAddButton}
                    onClick={() => { setShowTagInput(true); setTimeout(() => tagInputRef.current?.focus(), 50); }}
                    aria-label="タグを追加"
                  >
                    + タグ
                  </button>
                </li>
              )}
            </ul>
            {showTagInput && (
              <div className={styles.tagInputWrapper}>
                <input
                  ref={tagInputRef}
                  type="text"
                  className={styles.tagInput}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void handleTagAdd(tagInput); }
                    if (e.key === "Escape") { setShowTagInput(false); setTagInput(""); }
                  }}
                  placeholder="タグ名を入力..."
                  aria-label="タグ名を入力"
                />
                {tagSuggestions.length > 0 && tagInput.length > 0 && (
                  <ul className={styles.tagSuggestions}>
                    {tagSuggestions.slice(0, 6).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className={styles.tagSuggestionItem}
                          onClick={() => void handleTagAdd(t.name)}
                        >
                          {t.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className={styles.tagInputCancel} onClick={() => { setShowTagInput(false); setTagInput(""); }}>
                  キャンセル
                </button>
              </div>
            )}
          </div>
        )}

        <div className={styles.statusRow}>
          {bookmark.isReadable && (
            <StatusBadge status={bookmark.status} />
          )}
          {bookmark.isReadable && (
            <StatusSelector
              currentStatus={bookmark.status}
              onStatusChange={(status) => onStatusChange(bookmark.id, status)}
            />
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionButton} ${bookmark.pinned ? styles.toggleActive : ""}`}
          onClick={() => onTogglePin(bookmark.id)}
          aria-label={`${displayTitle} を${bookmark.pinned ? "ピン解除" : "ピン留め"}`}
          aria-pressed={bookmark.pinned}
        >
          {bookmark.pinned ? "📌 ピン解除" : "📍 ピン留め"}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => onAssignCollection(bookmark.id)}
          aria-label={`${displayTitle} を Collection に割り当て`}
        >
          振り分け
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${bookmark.isReadable ? styles.toggleActive : ""}`}
          onClick={() => onToggleReadable(bookmark.id)}
          aria-label={`${displayTitle} を読み物に${bookmark.isReadable ? "解除" : "設定"}`}
          aria-pressed={bookmark.isReadable}
        >
          {bookmark.isReadable ? "📖 読み物" : "📄 読み物"}
        </button>
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
      </div>

      <OGPPreviewCard
        bookmark={bookmark}
        visible={showPreview}
        position={previewPosition ?? undefined}
      />
    </article>
  );
}

export default BookmarkCard;
