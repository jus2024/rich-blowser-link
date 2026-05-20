/**
 * Tag 操作ユーティリティ
 *
 * Tag オートコンプリート、複数 Tag による AND フィルタ、Tag ごとの
 * Bookmark 数カウントといった純粋関数を集約するモジュール。副作用を
 * 持たず、UI コンポーネントやフック層から再利用しやすい形で提供する。
 */

import type {
  Bookmark,
  BookmarkTag,
  Tag,
  TagWithCount,
} from "@/src/types";

/** オートコンプリート候補として返す最大件数。Requirements 4.2 参照。 */
const TAG_SUGGESTIONS_MAX_COUNT = 10;

/**
 * 入力プレフィックスに前方一致する Tag をオートコンプリート候補として返す。
 *
 * 仕様:
 * - プレフィックスは前後の空白をトリムして評価する
 * - トリム後のプレフィックスが空文字列の場合は空配列を返す
 * - 大小文字を区別しない（両者を lowercase に揃えて比較）
 * - 入力 `tags` の順序を保持したまま先頭から最大 10 件を返す
 *
 * Validates: Requirements 4.2
 */
export function getTagSuggestions(tags: Tag[], prefix: string): Tag[] {
  const normalizedPrefix = prefix.trim().toLowerCase();
  if (normalizedPrefix.length === 0) {
    return [];
  }

  const matched: Tag[] = [];
  for (const tag of tags) {
    if (tag.name.toLowerCase().startsWith(normalizedPrefix)) {
      matched.push(tag);
      if (matched.length >= TAG_SUGGESTIONS_MAX_COUNT) {
        break;
      }
    }
  }

  return matched;
}

/**
 * 指定されたいずれかの Tag を持つ Bookmark を返す（OR 条件）。
 *
 * 仕様:
 * - `tagIds` が空配列の場合は `bookmarks` をそのまま返す（フィルタ無し）
 * - Bookmark は `tagIds` のいずれか1つ以上を付与されている場合に結果に含まれる
 * - 結果は入力 `bookmarks` の順序を保持する
 */
export function filterBookmarksByTags(
  bookmarks: Bookmark[],
  bookmarkTags: BookmarkTag[],
  tagIds: string[],
): Bookmark[] {
  if (tagIds.length === 0) {
    return bookmarks;
  }

  const tagIdSet = new Set(tagIds);
  const matchingBookmarkIds = new Set<string>();
  for (const bt of bookmarkTags) {
    if (tagIdSet.has(bt.tagId)) {
      matchingBookmarkIds.add(bt.bookmarkId);
    }
  }

  return bookmarks.filter((bookmark) => matchingBookmarkIds.has(bookmark.id));
}

/**
 * Tag ごとに紐づく Bookmark 数を付与した {@link TagWithCount} 配列を返す。
 *
 * 仕様:
 * - 入力 `tags` の順序を保持する
 * - `bookmarkTags` 内に当該 Tag の紐付けが存在しない場合、`bookmarkCount` は 0
 * - 同一 (bookmarkId, tagId) の重複は中間テーブルの仕様上は発生しない前提で
 *   単純に出現回数をそのままカウントする
 *
 * Validates: Requirements 4.4
 */
export function countBookmarksPerTag(
  tags: Tag[],
  bookmarkTags: BookmarkTag[],
): TagWithCount[] {
  const tagIdToCount = new Map<string, number>();
  for (const bt of bookmarkTags) {
    tagIdToCount.set(bt.tagId, (tagIdToCount.get(bt.tagId) ?? 0) + 1);
  }

  return tags.map((tag) => ({
    ...tag,
    bookmarkCount: tagIdToCount.get(tag.id) ?? 0,
  }));
}
