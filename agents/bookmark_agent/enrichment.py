"""AI エンリッチメントモジュール

Bedrock InvokeModel を使用してブックマークのメタデータを自動生成する。
既存の src/lib/ai/promptBuilder.ts のロジックを Python に移植。
"""

import json

import boto3
from botocore.config import Config

from common.config import get_aws_region, get_model_id
from common.logging import setup_logger

logger = setup_logger("bookmark_agent.enrichment")

# Bedrock 呼び出しのタイムアウト（秒）
BEDROCK_TIMEOUT = 30

# 空のエンリッチメント結果
EMPTY_ENRICHMENT_RESULT: dict = {
    "suggestedTags": [],
    "suggestedMemo": "",
    "suggestedTitle": "",
    "suggestedDescription": "",
    "suggestedCollection": "",
}


def build_enrichment_prompt(
    url: str,
    ogp_title: str,
    ogp_description: str,
    existing_tags: list[str],
    existing_collections: list[str],
) -> str:
    """エンリッチメントプロンプトを構築する（既存 promptBuilder.ts の Python 移植）

    Args:
        url: ブックマーク対象の URL
        ogp_title: OGP から取得したタイトル（空文字の場合は AI が生成）
        ogp_description: OGP から取得した説明（空文字の場合は AI が生成）
        existing_tags: ユーザーの既存タグ名リスト
        existing_collections: ユーザーの既存コレクション名リスト

    Returns:
        Bedrock に送信するプロンプト文字列
    """
    if ogp_title:
        title_instruction = (
            'The OGP title is already available. Return an empty string "" '
            'for the "title" field.'
        )
    else:
        title_instruction = (
            "The OGP title is missing. Generate a concise, descriptive title "
            '(max 200 characters) for the "title" field based on the URL and '
            "any available context."
        )

    if ogp_description:
        description_instruction = (
            'The OGP description is already available. Return an empty string "" '
            'for the "description" field.'
        )
    else:
        description_instruction = (
            "The OGP description is missing. Generate a brief description "
            '(max 500 characters) for the "description" field based on the URL '
            "and any available context."
        )

    existing_tags_section = ""
    if existing_tags:
        tags_list = ", ".join(existing_tags)
        existing_tags_section = (
            "\n## 既存タグ一覧\n\n"
            "以下はユーザーが既に作成済みのタグです。タグを選ぶ際は、"
            "**まずこの中から適切なものを優先的に選んでください**。"
            "該当するものがない場合のみ新しいタグを作成してください。\n\n"
            f"{tags_list}\n"
        )

    existing_collections_section = ""
    if existing_collections:
        collections_list = ", ".join(existing_collections)
        existing_collections_section = (
            "\n## 既存コレクション一覧\n\n"
            "以下はユーザーが既に作成済みのコレクション（フォルダ）です。"
            "このページが属すべきコレクションを**この中から1つだけ選んでください**。"
            'どれにも該当しない場合は空文字 "" を返してください。\n\n'
            f"{collections_list}\n"
        )

    return f"""あなたはブックマーク整理アシスタントです。以下のWebページ情報を分析し、メタデータを生成してください。

## ページ情報

- URL: {url}
- OGP タイトル: {ogp_title}
- OGP 説明: {ogp_description}
{existing_tags_section}{existing_collections_section}
## 指示

以下のメタデータを生成してください:

1. **tags**: このページを分類するための関連タグを1〜3個生成してください。各タグは単語または短いフレーズで、最大30文字です。

2. **memo**: ページの内容を1〜2文で要約してください（最大300文字）。ページの主なトピックや目的に焦点を当ててください。

3. **title**: {title_instruction}

4. **description**: {description_instruction}

5. **collection**: 既存コレクション一覧から、このページが最も適切に属するコレクション名を1つ選んでください。どれにも該当しない場合は空文字 "" を返してください。新しいコレクション名を作成しないでください。

## 言語

すべての出力（tags, memo, title, description）は日本語で生成してください。技術用語や固有名詞はそのまま使用して構いません。

## レスポンス形式

以下の形式の有効な JSON オブジェクトのみを返してください。追加のテキストや説明は不要です:

{{
  "tags": ["タグ1", "タグ2"],
  "memo": "ページの簡潔な要約。",
  "title": "",
  "description": "",
  "collection": ""
}}"""


def invoke_enrichment(prompt: str) -> dict:
    """Bedrock InvokeModel を呼び出し、エンリッチメント結果を返す

    Anthropic Messages API フォーマットで Claude モデルを呼び出し、
    JSON レスポンスをパースして返す。

    Args:
        prompt: build_enrichment_prompt で構築したプロンプト文字列

    Returns:
        エンリッチメント結果の辞書:
        {
            "suggestedTags": [...],
            "suggestedMemo": "...",
            "suggestedTitle": "...",
            "suggestedDescription": "...",
            "suggestedCollection": "..."
        }
        JSON パース失敗時やエラー時は空の結果を返す。
    """
    logger.info("Bedrock InvokeModel を呼び出します")

    try:
        region = get_aws_region()
        model_id = get_model_id()

        config = Config(
            read_timeout=BEDROCK_TIMEOUT,
            connect_timeout=BEDROCK_TIMEOUT,
        )
        client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=config,
        )

        # Anthropic Messages API フォーマット
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        })

        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=request_body,
        )

        # レスポンスボディをパース
        response_body = json.loads(response["body"].read())

        # Anthropic Messages API のレスポンス形式からテキストを抽出
        content = response_body.get("content", [])
        if not content or content[0].get("type") != "text":
            logger.warning("Bedrock レスポンスにテキストコンテンツがありません")
            return dict(EMPTY_ENRICHMENT_RESULT)

        text = content[0]["text"]

        # JSON をパース
        result = _parse_enrichment_response(text)
        logger.info("エンリッチメント完了: tags=%d", len(result.get("suggestedTags", [])))
        return result

    except json.JSONDecodeError as e:
        logger.warning("AI レスポンスの JSON パースに失敗しました: %s", str(e))
        return dict(EMPTY_ENRICHMENT_RESULT)
    except Exception as e:
        logger.error("Bedrock 呼び出しに失敗しました: %s", str(e))
        return dict(EMPTY_ENRICHMENT_RESULT)


def _parse_enrichment_response(text: str) -> dict:
    """AI レスポンスのテキストから JSON をパースし、正規化された結果を返す

    Args:
        text: AI モデルからのテキストレスポンス

    Returns:
        正規化されたエンリッチメント結果辞書
    """
    # JSON ブロックを抽出（```json ... ``` で囲まれている場合に対応）
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # コードブロックの中身を抽出
        lines = cleaned.split("\n")
        # 最初の ``` 行と最後の ``` 行を除去
        json_lines = []
        in_block = False
        for line in lines:
            if line.strip().startswith("```") and not in_block:
                in_block = True
                continue
            elif line.strip() == "```" and in_block:
                break
            elif in_block:
                json_lines.append(line)
        cleaned = "\n".join(json_lines)

    parsed = json.loads(cleaned)

    # レスポンスフィールドを正規化
    tags = parsed.get("tags", [])
    if not isinstance(tags, list):
        tags = []
    # 最大 3 個、各最大 30 文字
    suggested_tags = [str(tag)[:30] for tag in tags[:3]]

    memo = parsed.get("memo", "")
    if not isinstance(memo, str):
        memo = ""
    suggested_memo = memo[:300]

    title = parsed.get("title", "")
    if not isinstance(title, str):
        title = ""
    suggested_title = title[:200]

    description = parsed.get("description", "")
    if not isinstance(description, str):
        description = ""
    suggested_description = description[:500]

    collection = parsed.get("collection", "")
    if not isinstance(collection, str):
        collection = ""
    suggested_collection = collection

    return {
        "suggestedTags": suggested_tags,
        "suggestedMemo": suggested_memo,
        "suggestedTitle": suggested_title,
        "suggestedDescription": suggested_description,
        "suggestedCollection": suggested_collection,
    }
