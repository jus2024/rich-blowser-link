/**
 * AI Bookmark Enrichment API Route
 *
 * POST /api/ai-enrich
 * Body: { "url": "https://example.com", "ogpTitle": "...", "ogpDescription": "..." }
 * Response: EnrichmentResult
 *
 * Bedrock 呼び出し失敗時は HTTP 200 + 空 EnrichmentResult を返す（Graceful Degradation）
 */

import { NextRequest, NextResponse } from "next/server";
import { EMPTY_ENRICHMENT } from "@/src/lib/ai/types";
import { buildEnrichmentPrompt } from "@/src/lib/ai/promptBuilder";
import { createBedrockClient, invokeModel } from "@/src/lib/ai/bedrockClient";
import { parseEnrichmentResponse } from "@/src/lib/ai/responseParser";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "url is required" },
      { status: 400 },
    );
  }

  const { url, ogpTitle, ogpDescription, existingTags, existingCollections } = body as {
    url?: string;
    ogpTitle?: string;
    ogpDescription?: string;
    existingTags?: string[];
    existingCollections?: string[];
  };

  // バリデーション: url フィールド必須チェック
  if (!url) {
    return NextResponse.json(
      { error: "url is required" },
      { status: 400 },
    );
  }

  // バリデーション: URL フォーマット検証
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format" },
      { status: 400 },
    );
  }

  // 環境変数未設定時は空 EnrichmentResult を返す
  const modelId = process.env.BEDROCK_MODEL_ID;
  const region = process.env.BEDROCK_REGION || "us-east-1";
  if (!modelId) {
    return NextResponse.json(EMPTY_ENRICHMENT);
  }

  try {
    // プロンプト構築
    const prompt = buildEnrichmentPrompt({
      url,
      ogpTitle: ogpTitle || "",
      ogpDescription: ogpDescription || "",
      existingTags: existingTags || [],
      existingCollections: existingCollections || [],
    });

    // Bedrock クライアント初期化
    const config = {
      modelId,
      region,
      timeout: 8000,
    };
    const client = createBedrockClient(config);

    // InvokeModel 呼び出し
    const rawResponse = await invokeModel(client, prompt, config);

    // レスポンスパース
    const mapped = mapModelResponseFields(rawResponse);
    const result = parseEnrichmentResponse(mapped);

    return NextResponse.json(result);
  } catch (err) {
    // Bedrock 呼び出し失敗時は空 EnrichmentResult を返す（Graceful Degradation）
    console.error("[AI API] Bedrock call failed:", err);
    return NextResponse.json(EMPTY_ENRICHMENT);
  }
}

/**
 * モデルのレスポンス JSON のフィールド名を、パーサーが期待する形式にマッピングする。
 *
 * モデルは { tags, memo, title, description } を返すが、
 * パーサーは { suggestedTags, suggestedMemo, suggestedTitle, suggestedDescription } を期待する。
 */
function mapModelResponseFields(raw: string): string {
  try {
    // Markdown コードブロックを除去
    const trimmed = raw.trim();
    const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

    const parsed = JSON.parse(jsonStr);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return raw;
    }

    // 短いフィールド名が存在し、suggested* が存在しない場合のみマッピング
    const mapped: Record<string, unknown> = { ...parsed };

    if ("tags" in parsed && !("suggestedTags" in parsed)) {
      mapped.suggestedTags = parsed.tags;
      delete mapped.tags;
    }
    if ("memo" in parsed && !("suggestedMemo" in parsed)) {
      mapped.suggestedMemo = parsed.memo;
      delete mapped.memo;
    }
    if ("title" in parsed && !("suggestedTitle" in parsed)) {
      mapped.suggestedTitle = parsed.title;
      delete mapped.title;
    }
    if ("description" in parsed && !("suggestedDescription" in parsed)) {
      mapped.suggestedDescription = parsed.description;
      delete mapped.description;
    }
    if ("collection" in parsed && !("suggestedCollection" in parsed)) {
      mapped.suggestedCollection = parsed.collection;
      delete mapped.collection;
    }

    return JSON.stringify(mapped);
  } catch {
    // パース失敗時はそのまま返す（パーサーが EMPTY_ENRICHMENT を返す）
    return raw;
  }
}
