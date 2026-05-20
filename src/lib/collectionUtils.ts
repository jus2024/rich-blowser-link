/**
 * Collection 関連の純粋ユーティリティ関数群
 */

import type { Bookmark, BookmarkCollection, Collection, CollectionNode } from "@/src/types";

/**
 * フラットな Collection 配列からツリー構造を構築する。
 * 深さ3段（depth 0/1/2）まで。循環参照は無視する。
 */
export function buildCollectionTree(collections: Collection[]): CollectionNode[] {
  const byId = new Map<string, Collection>(collections.map((c) => [c.id, c]));
  const childrenMap = new Map<string | null, Collection[]>();

  for (const c of collections) {
    const parentKey = c.parentId ?? null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(c);
  }

  function buildNodes(parentId: string | null, depth: number): CollectionNode[] {
    if (depth > 2) return [];  // 最大3段（depth 0/1/2）
    const children = childrenMap.get(parentId) ?? [];
    return children
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .map((c) => ({
        ...c,
        depth,
        children: buildNodes(c.id, depth + 1),
      }));
  }

  return buildNodes(null, 0);
}

/**
 * `collectionId` フィールドで Bookmark をフィルタする（1対1版）。
 * collectionId === null → 未分類
 */
export function filterBookmarksByCollectionId(
  bookmarks: Bookmark[],
  collectionId: string | null,
): Bookmark[] {
  if (collectionId === null) {
    return bookmarks.filter((b) => b.collectionId === null || b.collectionId === undefined);
  }
  return bookmarks.filter((b) => b.collectionId === collectionId);
}

/**
 * Collection の深さを返す（0 = ルート）。
 * 循環参照防止のため最大深さ 3 で打ち切る。
 */
export function getCollectionDepth(
  collectionId: string,
  collectionsById: Map<string, Collection>,
): number {
  let depth = 0;
  let current = collectionsById.get(collectionId);
  while (current?.parentId && depth < 3) {
    depth += 1;
    current = collectionsById.get(current.parentId);
  }
  return depth;
}

/**
 * Collection メンバーシップに基づいて Bookmark をフィルタする（後方互換・中間テーブル版）。
 * 新規コードでは filterBookmarksByCollectionId を使うこと。
 */
export function filterBookmarksByCollection(
  bookmarks: Bookmark[],
  bookmarkCollections: BookmarkCollection[],
  collectionId: string | null,
): Bookmark[] {
  if (collectionId === null) {
    const categorizedBookmarkIds = new Set<string>();
    for (const bc of bookmarkCollections) {
      categorizedBookmarkIds.add(bc.bookmarkId);
    }
    return bookmarks.filter((bookmark) => !categorizedBookmarkIds.has(bookmark.id));
  }

  const memberBookmarkIds = new Set<string>();
  for (const bc of bookmarkCollections) {
    if (bc.collectionId === collectionId) {
      memberBookmarkIds.add(bc.bookmarkId);
    }
  }
  return bookmarks.filter((bookmark) => memberBookmarkIds.has(bookmark.id));
}
