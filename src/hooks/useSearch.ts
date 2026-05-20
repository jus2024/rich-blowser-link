"use client";

/**
 * useSearch フック
 *
 * 検索キーワードの入力を 300ms のデバウンスで受け付け、純粋関数の
 * `searchBookmarks` で Bookmark コレクションを検索する。I/O は持たず、
 * 呼び出し側から渡された Bookmark 配列のみを対象にする。
 *
 * 振る舞い:
 * - `query` は入力テキストをそのまま保持する（デバウンスしない）
 * - `query` の変更から 300ms 経過後に `searchBookmarks` を実行して
 *   `results` を更新する
 * - `isSearching` は「デバウンス待ち」または「検索実行中」の間 true
 * - 空または空白のみのキーワードでは `searchBookmarks` が `[]` を返すため
 *   `results` も `[]` になる
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { useEffect, useRef, useState } from "react";
import { searchBookmarks, type BookmarkWithTags } from "@/src/lib/search";
import type { Bookmark } from "@/src/types";

/** デバウンス遅延時間（ms）。Requirements 6.2 参照。 */
const DEBOUNCE_DELAY_MS = 300;

export interface UseSearchReturn {
  /** 検索結果の Bookmark 一覧（最大 50 件）。 */
  results: Bookmark[];
  /** デバウンス待ちまたは検索実行中かどうか。 */
  isSearching: boolean;
  /** 現在の検索キーワード（入力中の生の値）。 */
  query: string;
  /** 検索キーワードを更新する。 */
  setQuery: (q: string) => void;
}

/**
 * 検索キーワードをデバウンスしながら Bookmark コレクションを検索する
 * カスタムフック。
 *
 * @param bookmarks - 検索対象の Bookmark 配列（タグ名の一覧を含む）
 */
export function useSearch(bookmarks: BookmarkWithTags[]): UseSearchReturn {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 入力が変わるたびにデバウンス待ち状態に遷移する。
    setIsSearching(true);

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const searchResults = searchBookmarks(bookmarks, query);
      setResults(searchResults.map((r) => r.bookmark));
      setIsSearching(false);
      timeoutRef.current = null;
    }, DEBOUNCE_DELAY_MS);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [query, bookmarks]);

  return { results, isSearching, query, setQuery };
}
