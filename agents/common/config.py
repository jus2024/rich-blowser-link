"""エージェント共通設定"""

import os
from pathlib import Path

from dotenv import load_dotenv

# agents/ ディレクトリの .env を読み込む
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class ConfigurationError(Exception):
    """必須の設定が不足している場合に送出される例外"""

    pass


def get_model_id() -> str:
    """使用するモデル ID を取得する"""
    return os.getenv("MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")


def get_aws_region() -> str:
    """AWS リージョンを取得する"""
    return os.getenv("AWS_REGION", "us-west-2")


def get_table_names() -> dict[str, str]:
    """DynamoDB テーブル名を環境変数から取得する。

    未設定の環境変数がある場合は ConfigurationError を送出する。

    Returns:
        テーブル名の辞書（キー: bookmark, tag, bookmark_tag, collection, bookmark_collection）

    Raises:
        ConfigurationError: 必須の環境変数が未設定の場合
    """
    required_vars = {
        "bookmark": "BOOKMARK_TABLE_NAME",
        "tag": "TAG_TABLE_NAME",
        "bookmark_tag": "BOOKMARKTAG_TABLE_NAME",
        "collection": "COLLECTION_TABLE_NAME",
        "bookmark_collection": "BOOKMARKCOLLECTION_TABLE_NAME",
    }

    table_names: dict[str, str] = {}
    for key, env_var in required_vars.items():
        value = os.getenv(env_var)
        if not value:
            raise ConfigurationError(
                f"必須の環境変数 {env_var} が設定されていません"
            )
        table_names[key] = value

    return table_names
