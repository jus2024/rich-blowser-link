"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Bookmark, BookmarkStatus, Tag } from "@/src/types";
import { sortWithPinning } from "@/src/lib/pinningUtils";
import { BookmarkCard } from "./BookmarkCard";
import { SortableBookmarkList } from "./SortableBookmarkList";
import styles from "./BookmarkList.module.css";

export interface BookmarkListProps {
  /** 表示対象の Bookmark 一覧 */
  bookmarks: Bookmark[];
  /**
   * Bookmark ID から Tag 名配列へのマッピング。
   * BookmarkCard に渡す Tag バッジ表示用。未指定または該当なしの場合は空配列を渡す。
   */
  tagsByBookmarkId?: Record<string, string[]>;
  /** データ読込中フラグ */
  isLoading: boolean;
  /** さらに読み込むデータがあるか */
  hasMore: boolean;
  /** 次ページの読込をトリガーするコールバック */
  onLoadMore: () => void;
  /** 編集ボタンのハンドラ */
  onEdit: (id: string) => void;
  /** 削除ボタンのハンドラ */
  onDelete: (id: string) => void;
  /** リンククリック時のハンドラ。アクセス追跡用。 */
  onLinkClick: (id: string) => void;
  /** ステータス変更時のハンドラ */
  onStatusChange: (id: string, status: BookmarkStatus) => void;
  /** Collection 割り当てアクション時のハンドラ */
  onAssignCollection: (bookmarkId: string) => void;
  /** 読み物系トグルのハンドラ */
  onToggleReadable: (id: string) => void;
  /** ピン留めトグルのハンドラ */
  onTogglePin: (id: string) => void;
  /** 全タグ一覧（カード上でのタグ追加候補） */
  allTags?: Tag[];
  /** タグ追加ハンドラ */
  onAddTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  /** タグ削除ハンドラ */
  onRemoveTag?: (tagId: string, bookmarkId: string) => Promise<void>;
  /** タグ新規作成ハンドラ */
  onCreateTag?: (name: string) => Promise<Tag>;
  /** 選択中の Bookmark ID セット */
  selectedIds?: Set<string>;
  /** チェックボックス切替ハンドラ */
  onToggleSelect?: (id: string) => void;
}

/**
 * Bookmark 一覧コンポーネント。
 *
 * - Bookmark 配列を BookmarkCard として縦方向に一覧表示する。
 * - 0 件かつ非読込中の場合は空状態メッセージを表示する（要件 2.5）。
 * - `hasMore` が true の場合、リスト末尾に sentinel 要素を配置し、
 *   IntersectionObserver 経由で自動的に `onLoadMore` を呼び出す（無限スクロール）。
 * - 読込中は重複呼び出しを抑制する。
 */
export function BookmarkList({
  bookmarks,
  tagsByBookmarkId,
  isLoading,
  hasMore,
  onLoadMore,
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
}: BookmarkListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // コールバックを ref に保持し、observer の再構築による発火漏れを防ぐ
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    // jsdom など IntersectionObserver 非対応環境でのフォールバック
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) {
          return;
        }
        // 読込中は重複発火させない
        if (isLoadingRef.current) {
          return;
        }
        onLoadMoreRef.current();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore]);

  // ピン留めブックマークを先頭に表示するソートを常時適用する（Requirements 6.4）。
  // 安定ソートのため、既存の並び順（親側の sortedBookmarks 結果）を維持する。
  const orderedBookmarks = useMemo(
    () => sortWithPinning(bookmarks),
    [bookmarks]
  );

  // 空状態（要件 2.5）: 0 件かつ読込中でない場合のみ案内を表示
  if (bookmarks.length === 0 && !isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.empty} role="status">
          <p className={styles.emptyMessage}>
            Bookmark が未登録です。新規作成してください。
          </p>
        </div>
      </div>
    );
  }

  const renderItem = (bookmark: Bookmark, dragHandleProps?: React.HTMLAttributes<HTMLElement>) => (
    <div
      key={bookmark.id}
      role="listitem"
      style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selectedIds?.has(bookmark.id) ?? false}
          onChange={() => onToggleSelect(bookmark.id)}
          style={{
            marginTop: "1.2rem",
            width: "1rem",
            height: "1rem",
            flexShrink: 0,
          }}
          aria-label={`${bookmark.title || bookmark.url} を選択`}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <BookmarkCard
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
          dragHandleProps={dragHandleProps}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {/*
        リスト表示モード時は SortableBookmarkList でラップしてドラッグ&ドロップ並び替えを有効化する
        （Requirements 3.2）。DndContext は親（page.tsx）側で提供される前提。
      */}
      <div role="list" className={styles.list}>
        <SortableBookmarkList
          bookmarks={orderedBookmarks}
          isSortable={true}
          renderItem={renderItem}
        />
      </div>

      {isLoading && (
        <div className={styles.loading} role="status" aria-live="polite">
          読み込み中...
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      )}
    </div>
  );
}
