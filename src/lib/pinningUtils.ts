import type { Bookmark } from "@/src/types";

/**
 * ピン留めを考慮してブックマーク配列をソートする。
 * pinned=true のアイテムを先頭に、それぞれのグループ内では元の順序を維持する。
 *
 * @param bookmarks - ソート対象のブックマーク配列
 * @returns ピン留め優先でソートされた配列
 */
export function sortWithPinning(bookmarks: Bookmark[]): Bookmark[] {
  const pinned = bookmarks.filter((b) => b.pinned);
  const unpinned = bookmarks.filter((b) => !b.pinned);
  return [...pinned, ...unpinned];
}
