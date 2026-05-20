"""Bookmark Agent 用ツール

OGP メタデータ取得と Bookmark 検索のツール関数を定義します。
"""

import boto3
import requests
from botocore.exceptions import ClientError, ConnectTimeoutError, ReadTimeoutError
from strands import tool

from common.config import get_aws_region, get_table_names
from common.logging import setup_logger

logger = setup_logger("bookmark_agent.tools")

# OGP 取得のタイムアウト（秒）
OGP_FETCH_TIMEOUT = 10


@tool
def fetch_ogp(url: str) -> dict:
    """URL から OGP メタデータ（タイトル、説明、画像 URL）を取得する

    Args:
        url: OGP メタデータを取得する対象の URL

    Returns:
        OGP メタデータを含む辞書。取得失敗時は空の値を返す。
    """
    logger.info("OGP メタデータを取得します: %s", url)
    result = {"title": "", "description": "", "image_url": ""}

    try:
        response = requests.get(
            url,
            timeout=OGP_FETCH_TIMEOUT,
            headers={"User-Agent": "BookmarkAgent/1.0"},
        )
        response.raise_for_status()

        html = response.text

        # og:title
        title = _extract_meta_content(html, "og:title")
        if title:
            result["title"] = title[:200]

        # og:description
        description = _extract_meta_content(html, "og:description")
        if description:
            result["description"] = description[:500]

        # og:image
        image_url = _extract_meta_content(html, "og:image")
        if image_url:
            result["image_url"] = image_url[:2048]

    except (requests.RequestException, Exception) as e:
        logger.warning("OGP 取得に失敗しました (%s): %s", url, str(e))

    return result


@tool
def search_bookmarks(query: str, owner_id: str) -> str:
    """ユーザーの Bookmark コレクションをキーワードで検索する

    Args:
        query: 検索キーワード（スペース区切りで複数指定可）
        owner_id: Bookmark の所有者 ID（Cognito ユーザー ID）

    Returns:
        検索結果の構造化文字列（件数 + ブックマークリスト）
    """
    logger.info("Bookmark を検索します: query='%s', owner='%s'", query, owner_id)

    # owner_id のバリデーション
    if not owner_id or not owner_id.strip():
        return "エラー: owner_id は必須です。ユーザー識別情報を指定してください。"

    try:
        table_names = get_table_names()
        table_name = table_names["bookmark"]
        region = get_aws_region()

        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(table_name)

        response = table.scan(
            FilterExpression="#owner = :owner_id",
            ExpressionAttributeNames={"#owner": "owner"},
            ExpressionAttributeValues={":owner_id": owner_id},
        )
        items = response.get("Items", [])

        # キーワードでフィルタリング
        keywords = query.lower().split()
        results = []
        for item in items:
            title = (item.get("title") or "").lower()
            url = (item.get("url") or "").lower()
            description = (item.get("description") or "").lower()
            memo = (item.get("memo") or "").lower()

            match_count = 0
            for keyword in keywords:
                if keyword in title or keyword in url or keyword in description or keyword in memo:
                    match_count += 1

            if match_count > 0:
                results.append({
                    "id": item.get("id", ""),
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "description": item.get("description", ""),
                    "memo": item.get("memo", ""),
                    "_match_count": match_count,
                })

        # マッチ数の降順でソート
        results.sort(key=lambda x: x["_match_count"], reverse=True)

        # _match_count を除去して返却
        bookmarks = [
            {
                "id": r["id"],
                "title": r["title"],
                "url": r["url"],
                "description": r["description"],
                "memo": r["memo"],
            }
            for r in results
        ]

        logger.info("検索結果: %d 件", len(bookmarks))
        return str({"total_count": len(bookmarks), "bookmarks": bookmarks})

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error("DynamoDB ClientError: %s - %s", error_code, e.response["Error"]["Message"])
        return f"データの取得中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "予期しないエラーが発生しました。管理者にお問い合わせください。"


@tool
def get_bookmark_detail(bookmark_id: str, owner_id: str) -> str:
    """指定されたブックマークの詳細情報（関連タグ・コレクション含む）を取得する

    Args:
        bookmark_id: ブックマーク ID
        owner_id: Bookmark の所有者 ID（Cognito ユーザー ID）

    Returns:
        ブックマーク詳細の構造化文字列（全フィールド + タグ名リスト + コレクション名リスト）
    """
    logger.info("Bookmark 詳細を取得します: bookmark_id='%s', owner='%s'", bookmark_id, owner_id)

    # owner_id のバリデーション
    if not owner_id or not owner_id.strip():
        return "エラー: owner_id は必須です。ユーザー識別情報を指定してください。"

    try:
        table_names = get_table_names()
        region = get_aws_region()
        dynamodb = boto3.resource("dynamodb", region_name=region)

        # Bookmark テーブルから GetItem で取得
        bookmark_table = dynamodb.Table(table_names["bookmark"])
        response = bookmark_table.get_item(Key={"id": bookmark_id})
        item = response.get("Item")

        # 存在しない場合
        if not item:
            return "指定されたブックマークが見つかりません。"

        # owner フィールドの完全一致チェック（不一致時は存在を明かさない）
        if item.get("owner") != owner_id:
            return "指定されたブックマークが見つかりません。"

        # BookmarkTag テーブルから関連 tag_id を取得
        bookmark_tag_table = dynamodb.Table(table_names["bookmark_tag"])
        bt_response = bookmark_tag_table.scan(
            FilterExpression="#bookmarkId = :bookmark_id",
            ExpressionAttributeNames={"#bookmarkId": "bookmarkId"},
            ExpressionAttributeValues={":bookmark_id": bookmark_id},
        )
        bt_items = bt_response.get("Items", [])

        # 各 tag_id から Tag テーブルでタグ名を取得
        tag_table = dynamodb.Table(table_names["tag"])
        tags = []
        for bt_item in bt_items:
            tag_id = bt_item.get("tagId")
            if tag_id:
                tag_response = tag_table.get_item(Key={"id": tag_id})
                tag_item = tag_response.get("Item")
                if tag_item:
                    tags.append(tag_item.get("name", ""))

        # BookmarkCollection テーブルから関連 collection_id を取得
        bookmark_collection_table = dynamodb.Table(table_names["bookmark_collection"])
        bc_response = bookmark_collection_table.scan(
            FilterExpression="#bookmarkId = :bookmark_id",
            ExpressionAttributeNames={"#bookmarkId": "bookmarkId"},
            ExpressionAttributeValues={":bookmark_id": bookmark_id},
        )
        bc_items = bc_response.get("Items", [])

        # 各 collection_id から Collection テーブルでコレクション名を取得
        collection_table = dynamodb.Table(table_names["collection"])
        collections = []
        for bc_item in bc_items:
            collection_id = bc_item.get("collectionId")
            if collection_id:
                col_response = collection_table.get_item(Key={"id": collection_id})
                col_item = col_response.get("Item")
                if col_item:
                    collections.append(col_item.get("name", ""))

        # 構造化レスポンスを構築
        bookmark_detail = {
            "id": item.get("id", ""),
            "url": item.get("url", ""),
            "title": item.get("title", ""),
            "description": item.get("description", ""),
            "memo": item.get("memo", ""),
            "ogpImageUrl": item.get("ogpImageUrl", ""),
            "status": item.get("status", ""),
            "accessCount": item.get("accessCount", 0),
            "lastAccessedAt": item.get("lastAccessedAt", ""),
            "createdAt": item.get("createdAt", ""),
            "updatedAt": item.get("updatedAt", ""),
        }

        logger.info("Bookmark 詳細取得完了: tags=%d, collections=%d", len(tags), len(collections))
        return str({"bookmark": bookmark_detail, "tags": tags, "collections": collections})

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error("DynamoDB ClientError: %s - %s", error_code, e.response["Error"]["Message"])
        return f"データの取得中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "予期しないエラーが発生しました。管理者にお問い合わせください。"


@tool
def list_tags(owner_id: str) -> str:
    """ユーザーのタグ一覧を取得する

    Args:
        owner_id: タグの所有者 ID（Cognito ユーザー ID）

    Returns:
        タグ一覧の構造化文字列（件数 + タグリスト）
    """
    logger.info("タグ一覧を取得します: owner='%s'", owner_id)

    # owner_id のバリデーション
    if not owner_id or not owner_id.strip():
        return "エラー: owner_id は必須です。ユーザー識別情報を指定してください。"

    try:
        table_names = get_table_names()
        table_name = table_names["tag"]
        region = get_aws_region()

        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(table_name)

        response = table.scan(
            FilterExpression="#owner = :owner_id",
            ExpressionAttributeNames={"#owner": "owner"},
            ExpressionAttributeValues={":owner_id": owner_id},
        )
        items = response.get("Items", [])

        tags = [
            {"id": item.get("id", ""), "name": item.get("name", "")}
            for item in items
        ]

        logger.info("タグ一覧: %d 件", len(tags))
        return str({"total_count": len(tags), "tags": tags})

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error("DynamoDB ClientError: %s - %s", error_code, e.response["Error"]["Message"])
        return f"データの取得中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "予期しないエラーが発生しました。管理者にお問い合わせください。"


@tool
def list_bookmarks(
    owner_id: str,
    status: str = "",
    tag_name: str = "",
    collection_name: str = "",
    limit: int = 20,
) -> str:
    """ユーザーの Bookmark 一覧をフィルタ付きで取得する

    Args:
        owner_id: Bookmark の所有者 ID（Cognito ユーザー ID）
        status: ステータスフィルタ（"inbox", "read", "archived"、空文字で全件）
        tag_name: タグ名フィルタ（空文字で無効）
        collection_name: コレクション名フィルタ（空文字で無効）
        limit: 最大取得件数（デフォルト 20）

    Returns:
        一覧結果の構造化文字列（件数 + ブックマークリスト + more_exists フラグ）
    """
    logger.info(
        "Bookmark 一覧を取得します: owner='%s', status='%s', tag='%s', collection='%s', limit=%d",
        owner_id,
        status,
        tag_name,
        collection_name,
        limit,
    )

    # owner_id のバリデーション
    if not owner_id or not owner_id.strip():
        return "エラー: owner_id は必須です。ユーザー識別情報を指定してください。"

    try:
        table_names = get_table_names()
        region = get_aws_region()
        dynamodb = boto3.resource("dynamodb", region_name=region)

        # Bookmark テーブルを Scan（owner フィルタ）
        bookmark_table = dynamodb.Table(table_names["bookmark"])

        filter_expression = "#owner = :owner_id"
        expression_attr_names = {"#owner": "owner"}
        expression_attr_values = {":owner_id": owner_id}

        # status フィルタ
        if status:
            filter_expression += " AND #status = :status"
            expression_attr_names["#status"] = "status"
            expression_attr_values[":status"] = status

        response = bookmark_table.scan(
            FilterExpression=filter_expression,
            ExpressionAttributeNames=expression_attr_names,
            ExpressionAttributeValues=expression_attr_values,
        )
        items = response.get("Items", [])

        # tag_name フィルタ
        if tag_name:
            tag_table = dynamodb.Table(table_names["tag"])
            tag_response = tag_table.scan(
                FilterExpression="#owner = :owner_id AND #name = :tag_name",
                ExpressionAttributeNames={"#owner": "owner", "#name": "name"},
                ExpressionAttributeValues={":owner_id": owner_id, ":tag_name": tag_name},
            )
            tag_items = tag_response.get("Items", [])

            if tag_items:
                tag_id = tag_items[0]["id"]
                bookmark_tag_table = dynamodb.Table(table_names["bookmark_tag"])
                bt_response = bookmark_tag_table.scan(
                    FilterExpression="#tagId = :tag_id",
                    ExpressionAttributeNames={"#tagId": "tagId"},
                    ExpressionAttributeValues={":tag_id": tag_id},
                )
                bookmark_ids_by_tag = {
                    bt_item["bookmarkId"] for bt_item in bt_response.get("Items", [])
                }
                items = [item for item in items if item.get("id") in bookmark_ids_by_tag]
            else:
                items = []

        # collection_name フィルタ
        if collection_name:
            collection_table = dynamodb.Table(table_names["collection"])
            col_response = collection_table.scan(
                FilterExpression="#owner = :owner_id AND #name = :collection_name",
                ExpressionAttributeNames={"#owner": "owner", "#name": "name"},
                ExpressionAttributeValues={
                    ":owner_id": owner_id,
                    ":collection_name": collection_name,
                },
            )
            col_items = col_response.get("Items", [])

            if col_items:
                collection_id = col_items[0]["id"]
                bookmark_collection_table = dynamodb.Table(table_names["bookmark_collection"])
                bc_response = bookmark_collection_table.scan(
                    FilterExpression="#collectionId = :collection_id",
                    ExpressionAttributeNames={"#collectionId": "collectionId"},
                    ExpressionAttributeValues={":collection_id": collection_id},
                )
                bookmark_ids_by_collection = {
                    bc_item["bookmarkId"] for bc_item in bc_response.get("Items", [])
                }
                items = [item for item in items if item.get("id") in bookmark_ids_by_collection]
            else:
                items = []

        # 件数計算と limit 適用
        total_count = len(items)
        more_exists = total_count > limit
        limited_items = items[:limit]

        # レスポンス構築
        bookmarks = [
            {
                "id": item.get("id", ""),
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "status": item.get("status", ""),
                "createdAt": item.get("createdAt", ""),
            }
            for item in limited_items
        ]

        logger.info("一覧取得結果: total=%d, returned=%d", total_count, len(bookmarks))
        return str({
            "total_count": total_count,
            "returned_count": len(bookmarks),
            "more_exists": more_exists,
            "bookmarks": bookmarks,
        })

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error("DynamoDB ClientError: %s - %s", error_code, e.response["Error"]["Message"])
        return f"データの取得中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "予期しないエラーが発生しました。管理者にお問い合わせください。"


@tool
def list_collections(owner_id: str) -> str:
    """ユーザーのコレクション一覧を取得する

    Args:
        owner_id: コレクションの所有者 ID（Cognito ユーザー ID）

    Returns:
        コレクション一覧の構造化文字列（件数 + コレクションリスト）
    """
    logger.info("コレクション一覧を取得します: owner='%s'", owner_id)

    # owner_id のバリデーション
    if not owner_id or not owner_id.strip():
        return "エラー: owner_id は必須です。ユーザー識別情報を指定してください。"

    try:
        table_names = get_table_names()
        table_name = table_names["collection"]
        region = get_aws_region()

        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(table_name)

        response = table.scan(
            FilterExpression="#owner = :owner_id",
            ExpressionAttributeNames={"#owner": "owner"},
            ExpressionAttributeValues={":owner_id": owner_id},
        )
        items = response.get("Items", [])

        collections = [
            {
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "description": item.get("description", ""),
            }
            for item in items
        ]

        logger.info("コレクション一覧: %d 件", len(collections))
        return str({"total_count": len(collections), "collections": collections})

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error("DynamoDB ClientError: %s - %s", error_code, e.response["Error"]["Message"])
        return f"データの取得中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "予期しないエラーが発生しました。管理者にお問い合わせください。"


def _extract_meta_content(html: str, property_name: str) -> str:
    """HTML から指定された OGP メタタグの content 属性値を抽出する"""
    import re

    # <meta property="og:title" content="..." /> パターン
    prop_escaped = re.escape(property_name)
    pattern = (
        rf'<meta[^>]+property=["\']?{prop_escaped}["\']?'
        rf'[^>]+content=["\']([^"\']*)["\']'
    )
    match = re.search(pattern, html, re.IGNORECASE)
    if match:
        return match.group(1)

    # content が先に来るパターン
    pattern = (
        rf'<meta[^>]+content=["\']([^"\']*)["\']'
        rf'[^>]+property=["\']?{prop_escaped}["\']?'
    )
    match = re.search(pattern, html, re.IGNORECASE)
    if match:
        return match.group(1)

    return ""
