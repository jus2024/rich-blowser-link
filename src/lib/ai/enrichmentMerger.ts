/**
 * AI Enrichment マージャー
 *
 * EnrichmentResult の値を Bookmark の空フィールドにのみ適用する。
 * 非空フィールドは変更しない。
 */

import type { Bookmark } from "@/src/types";
import type { EnrichmentResult } from "./types";

/**
 * フィールドが「空」かどうかを判定する。
 * undefined, null, 空文字列 "" を空とみなす。
 */
function isEmpty(value: string | undefined | null): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Bookmark の空フィールドのみを EnrichmentResult の値で更新する。
 *
 * - title が空かつ suggestedTitle が非空 → title を更新
 * - description が空かつ suggestedDescription が非空 → description を更新
 * - memo が空かつ suggestedMemo が非空 → memo を更新
 * - 非空フィールドは変更しない
 * - suggestedTags はこの関数では適用しない（フロントエンドで別途処理）
 * - 入力オブジェクトを変更せず、新しいオブジェクトを返す
 */
export function mergeEnrichment(
  bookmark: Partial<Bookmark>,
  enrichment: EnrichmentResult,
): Partial<Bookmark> {
  const merged: Partial<Bookmark> = { ...bookmark };

  if (isEmpty(bookmark.title) && !isEmpty(enrichment.suggestedTitle)) {
    merged.title = enrichment.suggestedTitle;
  }

  if (isEmpty(bookmark.description) && !isEmpty(enrichment.suggestedDescription)) {
    merged.description = enrichment.suggestedDescription;
  }

  if (isEmpty(bookmark.memo) && !isEmpty(enrichment.suggestedMemo)) {
    merged.memo = enrichment.suggestedMemo;
  }

  return merged;
}
