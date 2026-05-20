/**
 * 全文検索ロジック
 *
 * Bookmark のタイトル・説明・URL・Tag を対象にキーワードの部分一致検索を
 * 行う純粋関数モジュール。検索キーワードの長さ制限、マッチフィールド数
 * によるランキング、件数上限などの振る舞いを集約する。
 *
 * Amplify Data など I/O を伴う処理はここでは扱わず、事前に取得済みの
 * Bookmark コレクションを入力として受け取る。
 */

import type { Bookmark } from "@/src/types";

/** 検索キーワードの最大文字数。Requirements 6.1, 6.5 参照。 */
const QUERY_MAX_LENGTH = 200;

/** 検索結果の最大件数。Requirements 6.1 参照。 */
const MAX_RESULTS = 50;

/**
 * 検索対象となる Bookmark。
 *
 * 付与されているタグ名一覧を `tags` フィールドに持つ。タグは Bookmark と
 * Tag の多対多関係を持つため、呼び出し側で事前に結合した状態で渡すことを
 * 想定する。
 */
export interface BookmarkWithTags extends Bookmark {
  /** Bookmark に紐付く Tag 名の一覧。 */
  tags: string[];
}

/**
 * 検索結果 1 件。
 *
 * `matchCount` は「タイトル・説明・URL・タグ」のうち、キーワードを含む
 * フィールドの個数（0〜4）。タグは 1 つでも一致すれば 1 としてカウントし、
 * タグごとの一致数は加算しない。
 */
export interface SearchResult {
  bookmark: BookmarkWithTags;
  /** 一致したフィールド数（0〜4）。0 件の場合は結果に含まれない。 */
  matchCount: number;
}

/**
 * Bookmark コレクションに対して全文検索を実行する。
 *
 * 振る舞い:
 * - 検索キーワードを先頭 200 文字に切り詰め、`toLowerCase` で小文字化する
 * - 切り詰め後のキーワードを `trim` した結果が空文字列の場合は `[]` を返す
 * - タイトル・説明・URL・タグ名のいずれかに部分一致する Bookmark のみを結果に含める
 * - `matchCount` は一致したフィールド数（タグは一致の有無で 1 としてカウント）
 * - `matchCount` の降順でソートし、同順位はもとの配列順を保つ（安定ソート）
 * - 結果は先頭 50 件までに切り詰める
 *
 * Validates: Requirements 6.1, 6.5
 */
export function searchBookmarks(
  bookmarks: BookmarkWithTags[],
  query: string,
): SearchResult[] {
  if (typeof query !== "string") {
    return [];
  }

  const truncated = query.slice(0, QUERY_MAX_LENGTH);
  if (truncated.trim().length === 0) {
    return [];
  }

  const needle = truncated.toLowerCase();

  const results: SearchResult[] = [];
  for (const bookmark of bookmarks) {
    const matchCount = countMatchingFields(bookmark, needle);
    if (matchCount > 0) {
      results.push({ bookmark, matchCount });
    }
  }

  // Array.prototype.sort は ECMAScript 2019 以降で安定ソートが保証されるため、
  // 同点の場合の順序は入力配列の出現順が維持される。
  results.sort((a, b) => b.matchCount - a.matchCount);

  return results.slice(0, MAX_RESULTS);
}

/**
 * 1 件の Bookmark について、キーワードを含むフィールド数を数える。
 *
 * タイトル・説明・URL はフィールド単位で 1 ずつカウントし、タグは配列中の
 * いずれかが一致すれば 1、いずれも一致しなければ 0 としてカウントする。
 */
function countMatchingFields(
  bookmark: BookmarkWithTags,
  needle: string,
): number {
  let count = 0;

  if (containsIgnoreCase(bookmark.title, needle)) {
    count += 1;
  }
  if (containsIgnoreCase(bookmark.description, needle)) {
    count += 1;
  }
  if (containsIgnoreCase(bookmark.url, needle)) {
    count += 1;
  }
  if (
    Array.isArray(bookmark.tags) &&
    bookmark.tags.some((tag) => containsIgnoreCase(tag, needle))
  ) {
    count += 1;
  }

  return count;
}

/**
 * `haystack` に `needle`（既に小文字化済み）を含むかを大文字小文字を
 * 区別せずに判定する。
 */
function containsIgnoreCase(haystack: unknown, needle: string): boolean {
  if (typeof haystack !== "string" || haystack.length === 0) {
    return false;
  }
  return haystack.toLowerCase().includes(needle);
}
