/**
 * 重複 URL 検出ユーティリティ
 *
 * Chrome ブックマークインポート時に、既存 Bookmark と URL が一致するエントリを
 * 検出する純粋関数を提供する。UI は検出結果を元に `skip` / `merge` の処理戦略を
 * ユーザーに提示する。
 */

import type { Bookmark } from "@/src/types";
import type { DuplicateCheckResult, ParsedBookmark } from "./types";

/**
 * パース済みブックマークと既存 Bookmark の間で URL の重複を検出する。
 *
 * URL は完全一致（大文字小文字・末尾スラッシュ・クエリ等を含む厳密比較）で突き合わせる。
 * 既存 Bookmark の URL を Set に格納し、`parsed` を入力順に走査して、
 * 既存と一致する URL を重複排除しつつ収集する（同じ URL が `parsed` 内で複数回
 * 出現した場合でも `duplicateUrls` には最初の 1 回のみ記録する）。
 *
 * 不変条件:
 * - `duplicateCount === duplicateUrls.length`
 * - `duplicateCount + newCount === parsed.length`
 * - `duplicateUrls` に含まれる URL は `parsed` と `existing` の両方に存在する
 *
 * Validates: Requirements 10.7
 *
 * @param parsed パース済みブックマーク一覧
 * @param existing 既存 Bookmark 一覧
 * @returns 重複 URL 一覧と件数サマリー
 */
export function checkDuplicateUrls(
  parsed: ParsedBookmark[],
  existing: Bookmark[]
): DuplicateCheckResult {
  const existingUrls = new Set<string>(existing.map((b) => b.url));

  const duplicateUrls: string[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    if (!existingUrls.has(entry.url)) {
      continue;
    }
    if (seen.has(entry.url)) {
      continue;
    }
    seen.add(entry.url);
    duplicateUrls.push(entry.url);
  }

  const duplicateCount = duplicateUrls.length;
  const newCount = parsed.length - duplicateCount;

  return {
    duplicateUrls,
    duplicateCount,
    newCount,
  };
}
