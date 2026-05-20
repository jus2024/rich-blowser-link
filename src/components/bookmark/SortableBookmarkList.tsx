"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Bookmark } from "@/src/types";
import { SortableBookmarkItem } from "./SortableBookmarkItem";

export interface SortableBookmarkListProps {
  /** 表示対象の Bookmark 一覧 */
  bookmarks: Bookmark[];
  /** ドラッグによる並び替えが有効か（リスト表示モード時のみ true） */
  isSortable: boolean;
  /**
   * 各ブックマークのレンダリング関数。
   * isSortable が true の場合、dragHandleProps がドラッグハンドル用の props として渡される。
   * コンポーネント側でこれを専用のハンドル要素に適用することで、
   * カード内ボタンのクリックがドラッグに横取りされるのを防ぐ。
   */
  renderItem: (bookmark: Bookmark, dragHandleProps?: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
}

/**
 * ブックマーク一覧にソート機能を付与するラッパーコンポーネント。
 *
 * - `isSortable` が true の場合: `SortableContext` + `verticalListSortingStrategy` で
 *   リストをラップし、各アイテムを `SortableBookmarkItem` で包む。
 * - `isSortable` が false の場合: ソート機能なしで通常レンダリングする。
 *
 * Requirements 3.2: リスト表示モードでのドラッグ&ドロップ並び替えを有効化
 * Requirements 3.5: grid/compact モードではドラッグ&ドロップ並び替えを無効化
 */
export function SortableBookmarkList({
  bookmarks,
  isSortable,
  renderItem,
}: SortableBookmarkListProps) {
  if (!isSortable) {
    return <>{bookmarks.map((bookmark) => renderItem(bookmark))}</>;
  }

  return (
    <SortableContext
      items={bookmarks.map((b) => b.id)}
      strategy={verticalListSortingStrategy}
    >
      {bookmarks.map((bookmark) => (
        <SortableBookmarkItem key={bookmark.id} id={bookmark.id}>
          {(dragHandleProps) => renderItem(bookmark, dragHandleProps)}
        </SortableBookmarkItem>
      ))}
    </SortableContext>
  );
}
