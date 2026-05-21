"""AgentCore Runtime に環境変数を設定するスクリプト

AWS CLI v1 では bedrock-agentcore の管理 API が使えないため、
boto3 で直接 update_agent_runtime を呼び出す。

Usage:
    cd agents
    .venv/bin/python scripts/set_env_vars.py
"""

import boto3
import json

REGION = "us-west-2"
AGENT_RUNTIME_ID = "bookmark_agent-De03rUDyNY"
ROLE_ARN = "arn:aws:iam::992382598974:role/AmazonBedrockAgentCoreSDKRuntime-us-west-2-5dfbf320f3"

ENVIRONMENT_VARIABLES = {
    "AWS_REGION": "us-west-2",
    "MODEL_ID": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "BOOKMARK_TABLE_NAME": "Bookmark-i5mcw5efwffx7bxwlgsodqjhou-NONE",
    "TAG_TABLE_NAME": "Tag-i5mcw5efwffx7bxwlgsodqjhou-NONE",
    "BOOKMARKTAG_TABLE_NAME": "BookmarkTag-i5mcw5efwffx7bxwlgsodqjhou-NONE",
    "COLLECTION_TABLE_NAME": "Collection-i5mcw5efwffx7bxwlgsodqjhou-NONE",
    "BOOKMARKCOLLECTION_TABLE_NAME": "BookmarkCollection-i5mcw5efwffx7bxwlgsodqjhou-NONE",
}

AUTHORIZER_CONFIGURATION = {
    "customJWTAuthorizer": {
        "discoveryUrl": "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_WH8bstOhf/.well-known/openid-configuration",
        "allowedClients": ["12rva5llt5b08hu1hh8lncca11"],
    }
}

NETWORK_CONFIGURATION = {"networkMode": "PUBLIC"}

AGENT_RUNTIME_ARTIFACT = {
    "codeConfiguration": {
        "code": {
            "s3": {
                "bucket": "bedrock-agentcore-codebuild-sources-992382598974-us-west-2",
                "prefix": "bookmark_agent/deployment.zip",
            }
        },
        "runtime": "PYTHON_3_11",
        "entryPoint": ["bookmark_agent/app.py"],
    }
}


def main():
    # コントロールプレーン API を使用
    client = boto3.client("bedrock-agentcore-control", region_name=REGION)

    print(f"Updating AgentCore Runtime: {AGENT_RUNTIME_ID}")
    print(f"Environment variables: {json.dumps(ENVIRONMENT_VARIABLES, indent=2)}")

    try:
        response = client.update_agent_runtime(
            agentRuntimeId=AGENT_RUNTIME_ID,
            roleArn=ROLE_ARN,
            networkConfiguration=NETWORK_CONFIGURATION,
            authorizerConfiguration=AUTHORIZER_CONFIGURATION,
            agentRuntimeArtifact=AGENT_RUNTIME_ARTIFACT,
            environmentVariables=ENVIRONMENT_VARIABLES,
        )
        print(f"\n✅ 更新成功!")
        print(f"Status: {response.get('status', 'N/A')}")
        print(f"Last Updated: {response.get('lastUpdatedAt', 'N/A')}")
    except client.exceptions.ResourceNotFoundException:
        print(f"\n❌ Runtime が見つかりません: {AGENT_RUNTIME_ID}")
    except Exception as e:
        print(f"\n❌ エラー: {e}")


if __name__ == "__main__":
    main()
