"use client";

import { useCallback } from "react";
import type { Bookmark } from "@/src/types";
import { sortWithPinning as sortWithPinningUtil } from "@/src/lib/pinningUtils";

/**
 * usePinning フックの戻り値。
 *
 * ピン留めのトグルとピン留め優先ソートを提供する。
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5
 */
export interface UsePinningReturn {
  /** ピン留めトグル */
  togglePin: (bookmarkId: string) => Promise<void>;
  /** ピン留めを考慮したソート関数 */
  sortWithPinning: (bookmarks: Bookmark[]) => Bookmark[];
}

/** updateBookmark に渡す入力型（pinned を含む拡張型） */
type UpdateBookmarkInput = Record<string, unknown> & { pinned?: boolean };

/**
 * ピン留め機能を提供するカスタムフック。
 *
 * - `togglePin`: 指定 Bookmark の `pinned` フィールドをトグルし、Amplify Data へ永続化する
 * - `sortWithPinning`: pinned=true のアイテムを先頭に配置するソート関数
 *
 * @param options.bookmarks - 現在のブックマーク配列（ピン状態の参照用）
 * @param options.updateBookmark - Bookmark を更新する関数（useBookmarks から取得）
 */
export function usePinning(options: {
  bookmarks: Bookmark[];
  updateBookmark: (id: string, input: UpdateBookmarkInput) => Promise<Bookmark>;
}): UsePinningReturn {
  const { bookmarks, updateBookmark } = options;

  const togglePin = useCallback(
    async (bookmarkId: string): Promise<void> => {
      const bookmark = bookmarks.find((b) => b.id === bookmarkId);
      if (!bookmark) return;

      const newPinned = !bookmark.pinned;
      await updateBookmark(bookmarkId, { pinned: newPinned });
    },
    [bookmarks, updateBookmark],
  );

  const sortWithPinning = useCallback(
    (items: Bookmark[]): Bookmark[] => {
      return sortWithPinningUtil(items);
    },
    [],
  );

  return {
    togglePin,
    sortWithPinning,
  };
}
