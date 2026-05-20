/**
 * AI Bookmark Enrichment - プロンプトビルダー
 */

import type { PromptContext } from "./types";

/**
 * Bedrock に送信するエンリッチメントプロンプトを構築する。
 *
 * URL、OGP タイトル、OGP 説明をコンテキストとして埋め込み、
 * JSON 形式での応答を指示する。
 */
export function buildEnrichmentPrompt(context: PromptContext): string {
  const { url, ogpTitle, ogpDescription, existingTags, existingCollections } = context;

  const titleInstruction = ogpTitle
    ? 'The OGP title is already available. Return an empty string "" for the "title" field.'
    : 'The OGP title is missing. Generate a concise, descriptive title (max 200 characters) for the "title" field based on the URL and any available context.';

  const descriptionInstruction = ogpDescription
    ? 'The OGP description is already available. Return an empty string "" for the "description" field.'
    : 'The OGP description is missing. Generate a brief description (max 500 characters) for the "description" field based on the URL and any available context.';

  const existingTagsSection = existingTags && existingTags.length > 0
    ? `\n## 既存タグ一覧\n\n以下はユーザーが既に作成済みのタグです。タグを選ぶ際は、**まずこの中から適切なものを優先的に選んでください**。該当するものがない場合のみ新しいタグを作成してください。\n\n${existingTags.join(", ")}\n`
    : "";

  const existingCollectionsSection = existingCollections && existingCollections.length > 0
    ? `\n## 既存コレクション一覧\n\n以下はユーザーが既に作成済みのコレクション（フォルダ）です。このページが属すべきコレクションを**この中から1つだけ選んでください**。どれにも該当しない場合は空文字 "" を返してください。\n\n${existingCollections.join(", ")}\n`
    : "";

  return `あなたはブックマーク整理アシスタントです。以下のWebページ情報を分析し、メタデータを生成してください。

## ページ情報

- URL: ${url}
- OGP タイトル: ${ogpTitle}
- OGP 説明: ${ogpDescription}
${existingTagsSection}${existingCollectionsSection}
## 指示

以下のメタデータを生成してください:

1. **tags**: このページを分類するための関連タグを1〜3個生成してください。各タグは単語または短いフレーズで、最大30文字です。

2. **memo**: ページの内容を1〜2文で要約してください（最大300文字）。ページの主なトピックや目的に焦点を当ててください。

3. **title**: ${titleInstruction}

4. **description**: ${descriptionInstruction}

5. **collection**: 既存コレクション一覧から、このページが最も適切に属するコレクション名を1つ選んでください。どれにも該当しない場合は空文字 "" を返してください。新しいコレクション名を作成しないでください。

## 言語

すべての出力（tags, memo, title, description）は日本語で生成してください。技術用語や固有名詞はそのまま使用して構いません。

## レスポンス形式

以下の形式の有効な JSON オブジェクトのみを返してください。追加のテキストや説明は不要です:

{
  "tags": ["タグ1", "タグ2"],
  "memo": "ページの簡潔な要約。",
  "title": "",
  "description": "",
  "collection": ""
}`;
}
