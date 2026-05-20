"use client";

import { useCallback, useState } from "react";
import type { Bookmark, Collection, DisplayMode } from "@/src/types";

// --- @dnd-kit/core 互換の型定義 ---
// パッケージインストール後は import type { DragStartEvent, ... } from "@dnd-kit/core" に置き換え可能
export interface DragStartEvent {
  active: { id: string | number; data?: { current?: Record<string, unknown> } };
}

export interface DragOverEvent {
  active: { id: string | number; data?: { current?: Record<string, unknown> } };
  over: { id: string | number; data?: { current?: Record<string, unknown> } } | null;
}

export interface DragEndEvent {
  active: { id: string | number; data?: { current?: Record<string, unknown> } };
  over: { id: string | number; data?: { current?: Record<string, unknown> } } | null;
}
// --- ここまで ---

/** コレクションドロップターゲットの ID プレフィックス */
const COLLECTION_PREFIX = "collection-";

export interface UseDragAndDropReturn {
  /** 現在ドラッグ中の Bookmark ID（null = ドラッグ中でない） */
  activeId: string | null;
  /** ドラッグオーバー中のコレクション ID */
  overCollectionId: string | null;
  /** DndContext のイベントハンドラ */
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  /** 重複通知メッセージ（null = 通知なし） */
  duplicateNotification: string | null;
  dismissNotification: () => void;
}

export interface UseDragAndDropOptions {
  bookmarks: Bookmark[];
  collections: Collection[];
  displayMode: DisplayMode;
  addBookmarkToCollection: (bookmarkId: string, collectionId: string) => Promise<void>;
  checkBookmarkInCollection: (bookmarkId: string, collectionId: string) => Promise<boolean>;
  onReorder: (bookmarkId: string, newIndex: number) => void;
}

/**
 * ドラッグ&ドロップの状態管理を一元化するカスタムフック。
 *
 * - コレクションへのドロップ: 重複チェック後に `addBookmarkToCollection` を呼び出し
 * - リスト表示モード時の並び替え: `onReorder` を呼び出し
 * - キャンセル時: 状態をリセットしデータは変更しない
 *
 * Validates: Requirements 2.3, 2.5, 2.6, 3.2
 */
export function useDragAndDrop(options: UseDragAndDropOptions): UseDragAndDropReturn {
  const {
    bookmarks,
    collections,
    displayMode,
    addBookmarkToCollection,
    checkBookmarkInCollection,
    onReorder,
  } = options;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCollectionId, setOverCollectionId] = useState<string | null>(null);
  const [duplicateNotification, setDuplicateNotification] = useState<string | null>(null);

  /**
   * over ターゲットの ID からコレクション ID を抽出する。
   * コレクションドロップターゲットは "collection-{id}" の形式を使用する。
   */
  const extractCollectionId = useCallback((overId: string | number): string | null => {
    const id = String(overId);
    if (id.startsWith(COLLECTION_PREFIX)) {
      return id.slice(COLLECTION_PREFIX.length);
    }
    return null;
  }, []);

  /**
   * ドラッグ開始: activeId を設定する。
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  /**
   * ドラッグオーバー: over ターゲットがコレクションかどうかを判定し、
   * overCollectionId を更新する。
   */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!event.over) {
        setOverCollectionId(null);
        return;
      }

      const collectionId = extractCollectionId(event.over.id);
      setOverCollectionId(collectionId);
    },
    [extractCollectionId],
  );

  /**
   * ドラッグ終了:
   * - コレクションにドロップ → 重複チェック後に addBookmarkToCollection
   * - リスト表示モードで別のブックマーク位置にドロップ → onReorder
   * - いずれの場合も状態をリセット
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const draggedId = String(event.active.id);

      try {
        if (event.over) {
          const collectionId = extractCollectionId(event.over.id);

          if (collectionId) {
            // コレクションへのドロップ
            const isDuplicate = await checkBookmarkInCollection(draggedId, collectionId);

            if (isDuplicate) {
              // 重複: 通知を表示し操作をキャンセル (Requirement 2.5)
              const collection = collections.find((c) => c.id === collectionId);
              const bookmark = bookmarks.find((b) => b.id === draggedId);
              const collectionName = collection?.name ?? "コレクション";
              const bookmarkTitle = bookmark?.title ?? "ブックマーク";
              setDuplicateNotification(
                `「${bookmarkTitle}」は既に「${collectionName}」に追加されています`,
              );
            } else {
              // 新規割り当て (Requirement 2.3)
              await addBookmarkToCollection(draggedId, collectionId);
            }
          } else if (displayMode === "list") {
            // リスト表示モード時の並び替え (Requirement 3.2)
            const overId = String(event.over.id);
            const overIndex = bookmarks.findIndex((b) => b.id === overId);

            if (overId !== draggedId && overIndex !== -1) {
              onReorder(draggedId, overIndex);
            }
          }
        }
        // over が null の場合はドロップターゲット外 → 何もしない (Requirement 2.6)
      } finally {
        // 状態リセット
        setActiveId(null);
        setOverCollectionId(null);
      }
    },
    [
      bookmarks,
      collections,
      displayMode,
      addBookmarkToCollection,
      checkBookmarkInCollection,
      onReorder,
      extractCollectionId,
    ],
  );

  /**
   * ドラッグキャンセル: データを変更せず状態のみリセットする (Requirement 2.6)。
   */
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverCollectionId(null);
  }, []);

  /**
   * 重複通知を閉じる。
   */
  const dismissNotification = useCallback(() => {
    setDuplicateNotification(null);
  }, []);

  return {
    activeId,
    overCollectionId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    duplicateNotification,
    dismissNotification,
  };
}
