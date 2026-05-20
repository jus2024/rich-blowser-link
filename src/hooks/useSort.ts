"use client";

/**
 * useSort フック
 *
 * Bookmark 一覧のソート条件（createdAt / lastAccessedAt / accessCount / sortOrder）を
 * 管理し、選択されたソートキーに基づいて Bookmark 配列をソートする関数を提供する。
 *
 * デフォルトのソートキーは "sortOrder"（並び順の昇順）。
 *
 * Validates: Requirements 3.6, 13.1, 13.5
 */

import { useState } from "react";
import type { Bookmark, SortKey } from "@/src/types";
import {
  sortByCreatedAt,
  sortByLastAccessedAt,
  sortByAccessCount,
  sortBySortOrder,
} from "@/src/lib/sortUtils";

export interface UseSortReturn {
  /** 現在のソートキー */
  sortKey: SortKey;
  /** ソートキーを変更する */
  setSortKey: (key: SortKey) => void;
  /** 現在のソートキーに基づいて Bookmark 配列をソートする */
  sortBookmarks: (bookmarks: Bookmark[]) => Bookmark[];
}

/**
 * Bookmark 一覧のソート状態を管理するカスタムフック。
 *
 * @returns ソートキーの状態と、Bookmark 配列をソートする関数
 */
export function useSort(): UseSortReturn {
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");

  const sortBookmarks = (bookmarks: Bookmark[]): Bookmark[] => {
    switch (sortKey) {
      case "sortOrder":
        return sortBySortOrder(bookmarks);
      case "createdAt":
        return sortByCreatedAt(bookmarks);
      case "lastAccessedAt":
        return sortByLastAccessedAt(bookmarks);
      case "accessCount":
        return sortByAccessCount(bookmarks);
      default:
        return sortBySortOrder(bookmarks);
    }
  };

  return { sortKey, setSortKey, sortBookmarks };
}
