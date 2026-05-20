"""テスト共通 fixture とヘルパー

moto で DynamoDB テーブルをモックし、Hypothesis 用のカスタム strategy を提供する。
"""

import uuid
from datetime import datetime, timezone

import boto3
import pytest
from hypothesis import strategies as st
from moto import mock_aws

# ---------------------------------------------------------------------------
# Environment variable fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _set_table_env_vars(monkeypatch):
    """テスト用のテーブル名環境変数を設定する"""
    monkeypatch.setenv("BOOKMARK_TABLE_NAME", "Bookmark")
    monkeypatch.setenv("TAG_TABLE_NAME", "Tag")
    monkeypatch.setenv("BOOKMARKTAG_TABLE_NAME", "BookmarkTag")
    monkeypatch.setenv("COLLECTION_TABLE_NAME", "Collection")
    monkeypatch.setenv("BOOKMARKCOLLECTION_TABLE_NAME", "BookmarkCollection")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")


# ---------------------------------------------------------------------------
# DynamoDB table creation helpers
# ---------------------------------------------------------------------------

def _create_bookmark_table(dynamodb):
    """Bookmark テーブルを作成する"""
    dynamodb.create_table(
        TableName="Bookmark",
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


def _create_tag_table(dynamodb):
    """Tag テーブルを作成する"""
    dynamodb.create_table(
        TableName="Tag",
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


def _create_bookmark_tag_table(dynamodb):
    """BookmarkTag テーブルを作成する（GSI: bookmarkId, tagId）"""
    dynamodb.create_table(
        TableName="BookmarkTag",
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
        AttributeDefinitions=[
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "bookmarkId", "AttributeType": "S"},
            {"AttributeName": "tagId", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "byBookmarkId",
                "KeySchema": [{"AttributeName": "bookmarkId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "byTagId",
                "KeySchema": [{"AttributeName": "tagId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
        BillingMode="PAY_PER_REQUEST",
    )


def _create_collection_table(dynamodb):
    """Collection テーブルを作成する"""
    dynamodb.create_table(
        TableName="Collection",
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


def _create_bookmark_collection_table(dynamodb):
    """BookmarkCollection テーブルを作成する（GSI: bookmarkId, collectionId）"""
    dynamodb.create_table(
        TableName="BookmarkCollection",
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
        AttributeDefinitions=[
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "bookmarkId", "AttributeType": "S"},
            {"AttributeName": "collectionId", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "byBookmarkId",
                "KeySchema": [{"AttributeName": "bookmarkId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "byCollectionId",
                "KeySchema": [{"AttributeName": "collectionId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
        BillingMode="PAY_PER_REQUEST",
    )


# ---------------------------------------------------------------------------
# DynamoDB mock fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def dynamodb_tables():
    """moto で全 5 テーブルを作成し、DynamoDB resource を返す"""
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        _create_bookmark_table(dynamodb)
        _create_tag_table(dynamodb)
        _create_bookmark_tag_table(dynamodb)
        _create_collection_table(dynamodb)
        _create_bookmark_collection_table(dynamodb)
        yield dynamodb


# ---------------------------------------------------------------------------
# Sample data generation helpers
# ---------------------------------------------------------------------------

def create_bookmark(
    dynamodb,
    owner: str,
    *,
    bookmark_id: str | None = None,
    url: str = "https://example.com",
    title: str = "Example Bookmark",
    description: str = "A sample bookmark",
    memo: str = "",
    ogp_image_url: str = "",
    status: str = "inbox",
    access_count: int = 0,
    last_accessed_at: str = "",
    created_at: str | None = None,
    updated_at: str | None = None,
) -> dict:
    """Bookmark テーブルにサンプルデータを挿入し、挿入したアイテムを返す"""
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": bookmark_id or str(uuid.uuid4()),
        "url": url,
        "title": title,
        "description": description,
        "memo": memo,
        "ogpImageUrl": ogp_image_url,
        "status": status,
        "accessCount": access_count,
        "lastAccessedAt": last_accessed_at,
        "createdAt": created_at or now,
        "updatedAt": updated_at or now,
        "owner": owner,
    }
    table = dynamodb.Table("Bookmark")
    table.put_item(Item=item)
    return item


def create_tag(
    dynamodb,
    owner: str,
    *,
    tag_id: str | None = None,
    name: str = "sample-tag",
) -> dict:
    """Tag テーブルにサンプルデータを挿入し、挿入したアイテムを返す"""
    item = {
        "id": tag_id or str(uuid.uuid4()),
        "name": name,
        "owner": owner,
    }
    table = dynamodb.Table("Tag")
    table.put_item(Item=item)
    return item


def create_bookmark_tag(
    dynamodb,
    owner: str,
    bookmark_id: str,
    tag_id: str,
    *,
    relation_id: str | None = None,
) -> dict:
    """BookmarkTag テーブルにサンプルデータを挿入し、挿入したアイテムを返す"""
    item = {
        "id": relation_id or str(uuid.uuid4()),
        "bookmarkId": bookmark_id,
        "tagId": tag_id,
        "owner": owner,
    }
    table = dynamodb.Table("BookmarkTag")
    table.put_item(Item=item)
    return item


def create_collection(
    dynamodb,
    owner: str,
    *,
    collection_id: str | None = None,
    name: str = "sample-collection",
    description: str = "A sample collection",
) -> dict:
    """Collection テーブルにサンプルデータを挿入し、挿入したアイテムを返す"""
    item = {
        "id": collection_id or str(uuid.uuid4()),
        "name": name,
        "description": description,
        "owner": owner,
    }
    table = dynamodb.Table("Collection")
    table.put_item(Item=item)
    return item


def create_bookmark_collection(
    dynamodb,
    owner: str,
    bookmark_id: str,
    collection_id: str,
    *,
    relation_id: str | None = None,
) -> dict:
    """BookmarkCollection テーブルにサンプルデータを挿入し、挿入したアイテムを返す"""
    item = {
        "id": relation_id or str(uuid.uuid4()),
        "bookmarkId": bookmark_id,
        "collectionId": collection_id,
        "owner": owner,
    }
    table = dynamodb.Table("BookmarkCollection")
    table.put_item(Item=item)
    return item


# ---------------------------------------------------------------------------
# Hypothesis custom strategies
# ---------------------------------------------------------------------------

# owner_id: Cognito sub 形式の UUID 文字列
owner_id_strategy = st.uuids().map(str)

# 2 つの異なる owner_id を生成する strategy
distinct_owner_ids_strategy = st.tuples(
    st.uuids().map(str),
    st.uuids().map(str),
).filter(lambda pair: pair[0] != pair[1])

# ブックマークのステータス
bookmark_status_strategy = st.sampled_from(["inbox", "read", "archived"])

# URL strategy（有効な URL 形式）
url_strategy = st.from_regex(
    r"https://[a-z]{3,10}\.[a-z]{2,5}/[a-z0-9]{1,20}",
    fullmatch=True,
)

# テキストフィールド strategy（タイトル、説明、メモ等）
text_field_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=100,
)

# タグ名 strategy
tag_name_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=1,
    max_size=50,
)

# コレクション名 strategy
collection_name_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=1,
    max_size=50,
)

# ブックマークデータ strategy（完全なブックマークアイテム生成用）
bookmark_data_strategy = st.fixed_dictionaries({
    "url": url_strategy,
    "title": text_field_strategy,
    "description": text_field_strategy,
    "memo": text_field_strategy,
    "status": bookmark_status_strategy,
})

# 検索キーワード strategy（1〜3 個のキーワード）
search_query_strategy = st.lists(
    st.text(
        alphabet=st.characters(whitelist_categories=("L", "N")),
        min_size=1,
        max_size=20,
    ),
    min_size=1,
    max_size=3,
).map(lambda words: " ".join(words))

# limit strategy（ページネーション用）
limit_strategy = st.integers(min_value=1, max_value=100)
