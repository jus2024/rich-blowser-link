/**
 * AI Bookmark Enrichment - レスポンスパーサー
 *
 * Bedrock から返された生テキストを EnrichmentResult にパースする。
 * 任意の文字列入力に対して例外を投げず、常に有効な EnrichmentResult を返す。
 */

import {
  EMPTY_ENRICHMENT,
  MAX_DESCRIPTION_LENGTH,
  MAX_MEMO_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  type EnrichmentResult,
} from "./types";

/**
 * Markdown コードブロックで囲まれた JSON を抽出する。
 * LLM が ```json ... ``` で囲んで返すケースに対応。
 */
function stripMarkdownCodeBlock(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (match) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * 文字列を指定文字数でトランケートする。
 */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

/**
 * suggestedTags フィールドをバリデーション・正規化する。
 * - 配列でなければ空配列を返す
 * - 文字列でない要素はフィルタする
 * - 各タグを MAX_TAG_LENGTH でトランケートする
 * - MAX_TAGS 個に切り詰める
 */
function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((tag) => truncate(tag, MAX_TAG_LENGTH))
    .slice(0, MAX_TAGS);
}

/**
 * 文字列フィールドをバリデーション・正規化する。
 * - 文字列でなければ空文字を返す
 * - 指定文字数でトランケートする
 */
function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return truncate(value, maxLength);
}

/**
 * Bedrock の生レスポンス文字列を EnrichmentResult にパースする。
 *
 * - JSON パース失敗時は EMPTY_ENRICHMENT を返す
 * - 欠落フィールドにはデフォルト値（空文字列、空配列）を適用する
 * - 余分なフィールドは無視する
 * - フィールド制約（文字数制限、タグ数制限）を適用する
 * - 決して例外を投げない
 */
export function parseEnrichmentResponse(raw: string): EnrichmentResult {
  try {
    const jsonStr = stripMarkdownCodeBlock(raw);
    const parsed = JSON.parse(jsonStr);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...EMPTY_ENRICHMENT };
    }

    return {
      suggestedTags: normalizeTags(parsed.suggestedTags),
      suggestedMemo: normalizeString(parsed.suggestedMemo, MAX_MEMO_LENGTH),
      suggestedTitle: normalizeString(parsed.suggestedTitle, MAX_TITLE_LENGTH),
      suggestedDescription: normalizeString(
        parsed.suggestedDescription,
        MAX_DESCRIPTION_LENGTH,
      ),
      suggestedCollection: normalizeString(parsed.suggestedCollection, 100),
    };
  } catch {
    return { ...EMPTY_ENRICHMENT };
  }
}
