import { NextRequest, NextResponse } from "next/server";

/**
 * OGP メタデータ取得 API Route
 *
 * POST /api/ogp
 * Body: { "url": "https://example.com" }
 * Response: { "title": "...", "description": "...", "imageUrl": "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 },
      );
    }

    // URL の妥当性チェック
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "RichBrowserLink/1.0 (OGP Fetcher)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { title: "", description: "", imageUrl: "" },
        { status: 200 },
      );
    }

    const html = await response.text();

    const title = extractMetaContent(html, "og:title") || extractTitle(html);
    const description =
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description");
    const imageUrl = extractMetaContent(html, "og:image") || "";

    return NextResponse.json({
      title: title.slice(0, 200),
      description: description.slice(0, 500),
      imageUrl: imageUrl.slice(0, 2048),
    });
  } catch {
    return NextResponse.json(
      { title: "", description: "", imageUrl: "" },
      { status: 200 },
    );
  }
}

function extractMetaContent(html: string, property: string): string {
  // <meta property="og:title" content="..." />
  const propPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']?${escapeRegex(property)}["']?[^>]+content=["']([^"']*)["']`,
    "i",
  );
  let match = propPattern.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  // content が先に来るパターン
  const contentFirstPattern = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']?${escapeRegex(property)}["']?`,
    "i",
  );
  match = contentFirstPattern.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  return "";
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
