"""Bookmark Agent CRUD ツール

ブックマークの作成・更新・削除・AI 補完のツール関数を定義します。
"""

import uuid
import urllib.parse
from datetime import datetime, timezone
import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError, ConnectTimeoutError, ReadTimeoutError
from strands import tool

from common.config import get_aws_region, get_table_names
from common.logging import setup_logger
from bookmark_agent.enrichment import build_enrichment_prompt, invoke_enrichment

logger = setup_logger("bookmark_agent.crud_tools")


def _is_valid_url(url: str) -> bool:
    """URL 形式のバリデーションを行う。

    scheme（http/https）と netloc が存在する場合に有効とみなす。
    """
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


@tool
def create_bookmark(url: str, owner_id: str) -> str:
    """URL を指定してブックマークを新規作成する

    Args:
        url: ブックマークする URL
        owner_id: 所有者 ID

    Returns:
        作成結果メッセージ（ID、タイトル、URL を含む）
    """
    logger.info("ブックマーク作成を開始します: url='%s', owner='%s'", url, owner_id)

    # URL 形式バリデーション
    if not _is_valid_url(url):
        logger.warning("不正な URL 形式: %s", url)
        return f"エラー: 指定された URL の形式が不正です。http:// または https:// で始まる有効な URL を指定してください。"

    try:
        table_names = get_table_names()
        table_name = table_names["bookmark"]
        region = get_aws_region()

        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(table_name)

        # UUID v4 で ID 生成
        bookmark_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        # DynamoDB PutItem（Amplify 互換フィールドを含む）
        item = {
            "__typename": "Bookmark",
            "id": bookmark_id,
            "url": url,
            "title": "",
            "description": "",
            "memo": "",
            "ogpImageUrl": "",
            "status": "inbox",
            "accessCount": 0,
            "lastAccessedAt": "",
            "isReadable": False,
            "sortOrder": 0,
            "pinned": False,
            "owner": owner_id,
            "createdAt": now,
            "updatedAt": now,
        }

        table.put_item(Item=item)

        logger.info("ブックマーク作成成功: id='%s'", bookmark_id)
        return (
            f"ブックマークを作成しました。\n"
            f"ID: {bookmark_id}\n"
            f"タイトル: (未取得)\n"
            f"URL: {url}"
        )

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "エラー: 一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error(
            "DynamoDB ClientError: %s - %s",
            error_code,
            e.response["Error"]["Message"],
        )
        return f"エラー: ブックマークの作成中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "エラー: 予期しないエラーが発生しました。管理者にお問い合わせください。"


def _get_dynamodb_resource():
    """DynamoDB リソースを取得する。"""
    region = get_aws_region()
    return boto3.resource("dynamodb", region_name=region)


def _find_or_create_tag(dynamodb, table_names: dict, tag_name: str, owner_id: str) -> str:
    """Tag テーブルで名前と owner で検索し、存在しなければ作成する。

    Returns:
        タグの ID
    """
    tag_table = dynamodb.Table(table_names["tag"])

    # name + owner で Scan して既存タグを検索
    response = tag_table.scan(
        FilterExpression=Attr("name").eq(tag_name) & Attr("owner").eq(owner_id)
    )

    items = response.get("Items", [])
    if items:
        return items[0]["id"]

    # 存在しなければ新規作成
    tag_id = str(uuid.uuid4())
    tag_table.put_item(
        Item={
            "__typename": "Tag",
            "id": tag_id,
            "name": tag_name,
            "owner": owner_id,
            "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        }
    )
    logger.info("タグを新規作成しました: id='%s', name='%s'", tag_id, tag_name)
    return tag_id


def _find_or_create_collection(
    dynamodb, table_names: dict, collection_name: str, owner_id: str
) -> str:
    """Collection テーブルで名前と owner で検索し、存在しなければ作成する。

    Returns:
        コレクションの ID
    """
    collection_table = dynamodb.Table(table_names["collection"])

    # name + owner で Scan して既存コレクションを検索
    response = collection_table.scan(
        FilterExpression=Attr("name").eq(collection_name) & Attr("owner").eq(owner_id)
    )

    items = response.get("Items", [])
    if items:
        return items[0]["id"]

    # 存在しなければ新規作成
    collection_id = str(uuid.uuid4())
    collection_table.put_item(
        Item={
            "__typename": "Collection",
            "id": collection_id,
            "name": collection_name,
            "description": "",
            "owner": owner_id,
            "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        }
    )
    logger.info(
        "コレクションを新規作成しました: id='%s', name='%s'",
        collection_id,
        collection_name,
    )
    return collection_id


@tool
def update_bookmark(
    bookmark_id: str,
    owner_id: str,
    memo: str = "",
    title: str = "",
    description: str = "",
    status: str = "",
    add_tags: list[str] | None = None,
    remove_tags: list[str] | None = None,
    add_collections: list[str] | None = None,
    remove_collections: list[str] | None = None,
) -> str:
    """ブックマークのフィールドを更新する

    Args:
        bookmark_id: 更新対象のブックマーク ID
        owner_id: 所有者 ID
        memo: メモ（空文字の場合は更新しない）
        title: タイトル（空文字の場合は更新しない）
        description: 説明（空文字の場合は更新しない）
        status: ステータス（空文字の場合は更新しない）
        add_tags: 追加するタグ名のリスト
        remove_tags: 削除するタグ名のリスト
        add_collections: 追加するコレクション名のリスト
        remove_collections: 削除するコレクション名のリスト

    Returns:
        更新結果メッセージ
    """
    logger.info(
        "ブックマーク更新を開始します: id='%s', owner='%s'",
        bookmark_id,
        owner_id,
    )

    try:
        table_names = get_table_names()
        dynamodb = _get_dynamodb_resource()
        bookmark_table = dynamodb.Table(table_names["bookmark"])

        # 1. GetItem で Bookmark 取得 + owner 検証
        response = bookmark_table.get_item(Key={"id": bookmark_id})
        item = response.get("Item")

        if not item or item.get("owner") != owner_id:
            logger.warning(
                "ブックマークが見つからないか owner 不一致: id='%s'", bookmark_id
            )
            return "ブックマークが見つかりません。"

        # 2. 指定フィールドの UpdateItem（空文字でないもののみ更新）
        update_expressions = []
        expression_values = {}
        expression_names = {}

        fields_to_update = {
            "memo": memo,
            "title": title,
            "description": description,
            "#st": status,
        }

        field_mapping = {
            "memo": "memo",
            "title": "title",
            "description": "description",
            "#st": "status",
        }

        for attr_name, value in fields_to_update.items():
            if value:  # 空文字でないもののみ
                update_expressions.append(f"{attr_name} = :{attr_name.strip('#')}")
                expression_values[f":{attr_name.strip('#')}"] = value
                if attr_name.startswith("#"):
                    expression_names[attr_name] = field_mapping[attr_name]

        if update_expressions:
            now = datetime.now(timezone.utc).isoformat()
            update_expressions.append("updatedAt = :updatedAt")
            expression_values[":updatedAt"] = now

            update_expr = "SET " + ", ".join(update_expressions)

            update_kwargs = {
                "Key": {"id": bookmark_id},
                "UpdateExpression": update_expr,
                "ExpressionAttributeValues": expression_values,
            }
            if expression_names:
                update_kwargs["ExpressionAttributeNames"] = expression_names

            bookmark_table.update_item(**update_kwargs)
            logger.info("ブックマークフィールドを更新しました: id='%s'", bookmark_id)

        # 3. タグ追加
        added_tags = []
        if add_tags:
            bookmark_tag_table = dynamodb.Table(table_names["bookmark_tag"])
            for tag_name in add_tags:
                tag_id = _find_or_create_tag(dynamodb, table_names, tag_name, owner_id)
                # BookmarkTag PutItem
                bookmark_tag_id = str(uuid.uuid4())
                now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                bookmark_tag_table.put_item(
                    Item={
                        "__typename": "BookmarkTag",
                        "id": bookmark_tag_id,
                        "bookmarkId": bookmark_id,
                        "tagId": tag_id,
                        "owner": owner_id,
                        "createdAt": now_ts,
                        "updatedAt": now_ts,
                    }
                )
                added_tags.append(tag_name)
                logger.info(
                    "タグを関連付けました: bookmark='%s', tag='%s'",
                    bookmark_id,
                    tag_name,
                )

        # 4. タグ削除
        removed_tags = []
        if remove_tags:
            bookmark_tag_table = dynamodb.Table(table_names["bookmark_tag"])
            tag_table = dynamodb.Table(table_names["tag"])

            for tag_name in remove_tags:
                # まず Tag テーブルで tag_id を取得
                tag_response = tag_table.scan(
                    FilterExpression=Attr("name").eq(tag_name)
                    & Attr("owner").eq(owner_id)
                )
                tag_items = tag_response.get("Items", [])
                if not tag_items:
                    continue

                tag_id = tag_items[0]["id"]

                # BookmarkTag テーブルで bookmarkId + tagId で検索
                bt_response = bookmark_tag_table.scan(
                    FilterExpression=Attr("bookmarkId").eq(bookmark_id)
                    & Attr("tagId").eq(tag_id)
                )
                bt_items = bt_response.get("Items", [])

                for bt_item in bt_items:
                    bookmark_tag_table.delete_item(Key={"id": bt_item["id"]})
                    logger.info(
                        "タグ関連を削除しました: bookmark='%s', tag='%s'",
                        bookmark_id,
                        tag_name,
                    )

                removed_tags.append(tag_name)

        # 5. Collection 追加
        added_collections = []
        if add_collections:
            bookmark_collection_table = dynamodb.Table(
                table_names["bookmark_collection"]
            )
            for collection_name in add_collections:
                collection_id = _find_or_create_collection(
                    dynamodb, table_names, collection_name, owner_id
                )
                # BookmarkCollection PutItem
                bookmark_collection_id = str(uuid.uuid4())
                now_ts2 = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                bookmark_collection_table.put_item(
                    Item={
                        "__typename": "BookmarkCollection",
                        "id": bookmark_collection_id,
                        "bookmarkId": bookmark_id,
                        "collectionId": collection_id,
                        "owner": owner_id,
                        "createdAt": now_ts2,
                        "updatedAt": now_ts2,
                    }
                )
                added_collections.append(collection_name)
                logger.info(
                    "コレクションを関連付けました: bookmark='%s', collection='%s'",
                    bookmark_id,
                    collection_name,
                )

        # 6. Collection 削除
        removed_collections = []
        if remove_collections:
            bookmark_collection_table = dynamodb.Table(
                table_names["bookmark_collection"]
            )
            collection_table = dynamodb.Table(table_names["collection"])

            for collection_name in remove_collections:
                # まず Collection テーブルで collection_id を取得
                col_response = collection_table.scan(
                    FilterExpression=Attr("name").eq(collection_name)
                    & Attr("owner").eq(owner_id)
                )
                col_items = col_response.get("Items", [])
                if not col_items:
                    continue

                collection_id = col_items[0]["id"]

                # BookmarkCollection テーブルで bookmarkId + collectionId で検索
                bc_response = bookmark_collection_table.scan(
                    FilterExpression=Attr("bookmarkId").eq(bookmark_id)
                    & Attr("collectionId").eq(collection_id)
                )
                bc_items = bc_response.get("Items", [])

                for bc_item in bc_items:
                    bookmark_collection_table.delete_item(Key={"id": bc_item["id"]})
                    logger.info(
                        "コレクション関連を削除しました: bookmark='%s', collection='%s'",
                        bookmark_id,
                        collection_name,
                    )

                removed_collections.append(collection_name)

        # 結果メッセージの構築
        updates = []
        if update_expressions:
            updated_fields = []
            if memo:
                updated_fields.append("メモ")
            if title:
                updated_fields.append("タイトル")
            if description:
                updated_fields.append("説明")
            if status:
                updated_fields.append("ステータス")
            if updated_fields:
                updates.append(f"フィールド更新: {', '.join(updated_fields)}")

        if added_tags:
            updates.append(f"タグ追加: {', '.join(added_tags)}")
        if removed_tags:
            updates.append(f"タグ削除: {', '.join(removed_tags)}")
        if added_collections:
            updates.append(f"コレクション追加: {', '.join(added_collections)}")
        if removed_collections:
            updates.append(f"コレクション削除: {', '.join(removed_collections)}")

        if not updates:
            return "更新する内容が指定されていません。"

        result_message = f"ブックマークを更新しました（ID: {bookmark_id}）。\n"
        result_message += "\n".join(f"- {u}" for u in updates)

        logger.info("ブックマーク更新完了: id='%s'", bookmark_id)
        return result_message

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "エラー: 一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error(
            "DynamoDB ClientError: %s - %s",
            error_code,
            e.response["Error"]["Message"],
        )
        return f"エラー: ブックマークの更新中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "エラー: 予期しないエラーが発生しました。管理者にお問い合わせください。"


@tool
def delete_bookmark(bookmark_id: str, owner_id: str) -> str:
    """ブックマークと関連レコードを削除する

    Args:
        bookmark_id: 削除対象のブックマーク ID
        owner_id: 所有者 ID

    Returns:
        削除結果メッセージ（タイトルと URL を含む）
    """
    logger.info(
        "ブックマーク削除を開始します: id='%s', owner='%s'",
        bookmark_id,
        owner_id,
    )

    try:
        table_names = get_table_names()
        dynamodb = _get_dynamodb_resource()
        bookmark_table = dynamodb.Table(table_names["bookmark"])

        # 1. GetItem で Bookmark 取得 + owner 検証
        response = bookmark_table.get_item(Key={"id": bookmark_id})
        item = response.get("Item")

        if not item or item.get("owner") != owner_id:
            logger.warning(
                "ブックマークが見つからないか owner 不一致: id='%s'", bookmark_id
            )
            return "ブックマークが見つかりません。"

        bookmark_title = item.get("title", "")
        bookmark_url = item.get("url", "")

        # 2. BookmarkTag テーブルから関連レコードを Scan → 各レコードを DeleteItem
        bookmark_tag_table = dynamodb.Table(table_names["bookmark_tag"])
        bt_response = bookmark_tag_table.scan(
            FilterExpression=Attr("bookmarkId").eq(bookmark_id)
        )
        bt_items = bt_response.get("Items", [])

        for bt_item in bt_items:
            bookmark_tag_table.delete_item(Key={"id": bt_item["id"]})
            logger.info(
                "BookmarkTag レコードを削除しました: id='%s'", bt_item["id"]
            )

        # 3. BookmarkCollection テーブルから関連レコードを Scan → 各レコードを DeleteItem
        bookmark_collection_table = dynamodb.Table(
            table_names["bookmark_collection"]
        )
        bc_response = bookmark_collection_table.scan(
            FilterExpression=Attr("bookmarkId").eq(bookmark_id)
        )
        bc_items = bc_response.get("Items", [])

        for bc_item in bc_items:
            bookmark_collection_table.delete_item(Key={"id": bc_item["id"]})
            logger.info(
                "BookmarkCollection レコードを削除しました: id='%s'",
                bc_item["id"],
            )

        # 4. Bookmark レコードを DeleteItem
        bookmark_table.delete_item(Key={"id": bookmark_id})
        logger.info("ブックマークを削除しました: id='%s'", bookmark_id)

        # 5. 成功メッセージ
        title_display = bookmark_title if bookmark_title else "(タイトルなし)"
        return (
            f"ブックマークを削除しました。\n"
            f"タイトル: {title_display}\n"
            f"URL: {bookmark_url}"
        )

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "エラー: 一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error(
            "DynamoDB ClientError: %s - %s",
            error_code,
            e.response["Error"]["Message"],
        )
        return f"エラー: ブックマークの削除中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "エラー: 予期しないエラーが発生しました。管理者にお問い合わせください。"


@tool
def enrich_bookmark(bookmark_id: str, owner_id: str) -> str:
    """既存ブックマークに AI 補完を実行する

    URL と既存メタデータを使用して AI エンリッチメントを実行し、
    空フィールドのみに補完結果を適用する。

    Args:
        bookmark_id: 補完対象のブックマーク ID
        owner_id: 所有者 ID

    Returns:
        適用された補完内容のサマリーメッセージ
    """
    logger.info(
        "ブックマーク AI 補完を開始します: id='%s', owner='%s'",
        bookmark_id,
        owner_id,
    )

    try:
        table_names = get_table_names()
        dynamodb = _get_dynamodb_resource()
        bookmark_table = dynamodb.Table(table_names["bookmark"])

        # 1. GetItem で Bookmark 取得 + owner 検証
        response = bookmark_table.get_item(Key={"id": bookmark_id})
        item = response.get("Item")

        if not item or item.get("owner") != owner_id:
            logger.warning(
                "ブックマークが見つからないか owner 不一致: id='%s'", bookmark_id
            )
            return "ブックマークが見つかりません。"

        bookmark_url = item.get("url", "")
        bookmark_title = item.get("title", "")
        bookmark_description = item.get("description", "")
        bookmark_memo = item.get("memo", "")

        # 2. 既存タグ・コレクション一覧を取得（プロンプトコンテキスト用）
        existing_tags = _get_existing_tags(dynamodb, table_names, owner_id)
        existing_collections = _get_existing_collections(
            dynamodb, table_names, owner_id
        )

        # 3. build_enrichment_prompt を呼び出し
        prompt = build_enrichment_prompt(
            url=bookmark_url,
            ogp_title=bookmark_title,
            ogp_description=bookmark_description,
            existing_tags=existing_tags,
            existing_collections=existing_collections,
        )

        # 4. invoke_enrichment を呼び出し
        enrichment_result = invoke_enrichment(prompt)

        # AI 補完失敗チェック（空の結果が返された場合）
        if _is_empty_enrichment_result(enrichment_result):
            logger.warning("AI 補完が空の結果を返しました: id='%s'", bookmark_id)
            return "エラー: AI 補完の実行に失敗しました。既存のデータは変更されていません。"

        # 5. 空フィールドのみに結果を適用
        update_expressions = []
        expression_values = {}
        applied_updates = []

        # suggestedTitle → title が空の場合のみ更新
        suggested_title = enrichment_result.get("suggestedTitle", "")
        if suggested_title and not bookmark_title:
            update_expressions.append("title = :title")
            expression_values[":title"] = suggested_title
            applied_updates.append(f"タイトル: {suggested_title}")

        # suggestedDescription → description が空の場合のみ更新
        suggested_description = enrichment_result.get("suggestedDescription", "")
        if suggested_description and not bookmark_description:
            update_expressions.append("description = :description")
            expression_values[":description"] = suggested_description
            applied_updates.append(f"説明: {suggested_description}")

        # suggestedMemo → memo が空の場合のみ更新
        suggested_memo = enrichment_result.get("suggestedMemo", "")
        if suggested_memo and not bookmark_memo:
            update_expressions.append("memo = :memo")
            expression_values[":memo"] = suggested_memo
            applied_updates.append(f"メモ: {suggested_memo}")

        # UpdateItem 実行（更新するフィールドがある場合）
        if update_expressions:
            now = datetime.now(timezone.utc).isoformat()
            update_expressions.append("updatedAt = :updatedAt")
            expression_values[":updatedAt"] = now

            update_expr = "SET " + ", ".join(update_expressions)
            bookmark_table.update_item(
                Key={"id": bookmark_id},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expression_values,
            )
            logger.info(
                "ブックマークフィールドを AI 補完で更新しました: id='%s'",
                bookmark_id,
            )

        # 6. suggestedTags → Tag 検索/作成 + BookmarkTag 関連付け
        suggested_tags = enrichment_result.get("suggestedTags", [])
        added_tags = []
        if suggested_tags:
            bookmark_tag_table = dynamodb.Table(table_names["bookmark_tag"])
            for tag_name in suggested_tags:
                if not tag_name:
                    continue
                tag_id = _find_or_create_tag(
                    dynamodb, table_names, tag_name, owner_id
                )
                # 既に関連付けられていないか確認
                existing_bt = bookmark_tag_table.scan(
                    FilterExpression=Attr("bookmarkId").eq(bookmark_id)
                    & Attr("tagId").eq(tag_id)
                )
                if not existing_bt.get("Items"):
                    bookmark_tag_id = str(uuid.uuid4())
                    now_tag = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                    bookmark_tag_table.put_item(
                        Item={
                            "__typename": "BookmarkTag",
                            "id": bookmark_tag_id,
                            "bookmarkId": bookmark_id,
                            "tagId": tag_id,
                            "owner": owner_id,
                            "createdAt": now_tag,
                            "updatedAt": now_tag,
                        }
                    )
                    added_tags.append(tag_name)
                    logger.info(
                        "AI 補完でタグを関連付けました: bookmark='%s', tag='%s'",
                        bookmark_id,
                        tag_name,
                    )

        if added_tags:
            applied_updates.append(f"タグ追加: {', '.join(added_tags)}")

        # 7. suggestedCollection → Collection 検索/作成 + BookmarkCollection 関連付け
        suggested_collection = enrichment_result.get("suggestedCollection", "")
        if suggested_collection:
            bookmark_collection_table = dynamodb.Table(
                table_names["bookmark_collection"]
            )
            collection_id = _find_or_create_collection(
                dynamodb, table_names, suggested_collection, owner_id
            )
            # 既に関連付けられていないか確認
            existing_bc = bookmark_collection_table.scan(
                FilterExpression=Attr("bookmarkId").eq(bookmark_id)
                & Attr("collectionId").eq(collection_id)
            )
            if not existing_bc.get("Items"):
                bookmark_collection_id = str(uuid.uuid4())
                now_col = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                bookmark_collection_table.put_item(
                    Item={
                        "__typename": "BookmarkCollection",
                        "id": bookmark_collection_id,
                        "bookmarkId": bookmark_id,
                        "collectionId": collection_id,
                        "owner": owner_id,
                        "createdAt": now_col,
                        "updatedAt": now_col,
                    }
                )
                applied_updates.append(f"コレクション追加: {suggested_collection}")
                logger.info(
                    "AI 補完でコレクションを関連付けました: bookmark='%s', collection='%s'",
                    bookmark_id,
                    suggested_collection,
                )

        # 8. 成功時: 適用された補完内容のサマリーを返却
        if not applied_updates:
            return (
                f"AI 補完を実行しましたが、適用する内容がありませんでした"
                f"（既にフィールドが入力済みです）。\n"
                f"ブックマーク ID: {bookmark_id}"
            )

        result_message = f"AI 補完を実行しました（ブックマーク ID: {bookmark_id}）。\n"
        result_message += "\n".join(f"- {u}" for u in applied_updates)

        logger.info("ブックマーク AI 補完完了: id='%s'", bookmark_id)
        return result_message

    except (ConnectTimeoutError, ReadTimeoutError):
        logger.error("DynamoDB 接続タイムアウト")
        return "エラー: 一時的にサービスに接続できません。しばらく待ってから再度お試しください。"
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error(
            "DynamoDB ClientError: %s - %s",
            error_code,
            e.response["Error"]["Message"],
        )
        return f"エラー: AI 補完の実行中にエラーが発生しました: {error_code}"
    except Exception as e:
        logger.error("予期しないエラー: %s", str(e))
        return "エラー: 予期しないエラーが発生しました。管理者にお問い合わせください。"


def _get_existing_tags(dynamodb, table_names: dict, owner_id: str) -> list[str]:
    """ユーザーの既存タグ名一覧を取得する。"""
    try:
        tag_table = dynamodb.Table(table_names["tag"])
        response = tag_table.scan(
            FilterExpression=Attr("owner").eq(owner_id)
        )
        items = response.get("Items", [])
        return [item["name"] for item in items if "name" in item]
    except Exception as e:
        logger.warning("既存タグの取得に失敗しました: %s", str(e))
        return []


def _get_existing_collections(
    dynamodb, table_names: dict, owner_id: str
) -> list[str]:
    """ユーザーの既存コレクション名一覧を取得する。"""
    try:
        collection_table = dynamodb.Table(table_names["collection"])
        response = collection_table.scan(
            FilterExpression=Attr("owner").eq(owner_id)
        )
        items = response.get("Items", [])
        return [item["name"] for item in items if "name" in item]
    except Exception as e:
        logger.warning("既存コレクションの取得に失敗しました: %s", str(e))
        return []


def _is_empty_enrichment_result(result: dict) -> bool:
    """エンリッチメント結果が空かどうかを判定する。"""
    if not result:
        return True
    tags = result.get("suggestedTags", [])
    memo = result.get("suggestedMemo", "")
    title = result.get("suggestedTitle", "")
    description = result.get("suggestedDescription", "")
    collection = result.get("suggestedCollection", "")
    return not tags and not memo and not title and not description and not collection
