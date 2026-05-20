# Strands Agents — Bookmark Agent

Rich Browser Link のオプション AI エージェント機能です。
Strands Agents SDK を使い、Amazon Bedrock AgentCore Runtime 上で実行されます。

## ディレクトリ構成

```
agents/
  bookmark_agent/       # ブックマーク操作エージェント
    agent.py            # エージェント定義（プロンプト、ツール構成）
    app.py              # AgentCore Runtime エントリーポイント
    tools.py            # カスタムツール定義
  common/               # 共通処理（設定、ログ）
  scripts/              # ローカル実行スクリプト
  tests/                # テスト
  pyproject.toml        # Python プロジェクト定義
```

## セットアップ

```bash
cd agents
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

## 環境変数

```bash
cp .env.example .env
# .env を編集して必要な値を設定
```

## ローカル開発

```bash
# AgentCore Runtime 不要のローカル動作確認
python scripts/run_local.py
```

ローカル実行では AgentCore Runtime を使わず、エージェントのロジックとツールを直接テストできます。

## テスト

```bash
python -m pytest
```

## デプロイ（AgentCore Runtime）

### 初回デプロイ

```bash
# 初回設定（Cognito の User Pool ID と Client ID が必要）
agentcore configure \
  --entrypoint bookmark_agent/app.py \
  --name bookmark_agent \
  --authorizer-config '{"customJWTAuthorizer":{"discoveryUrl":"https://cognito-idp.<region>.amazonaws.com/<User Pool ID>/.well-known/openid-configuration","allowedClients":["<Client ID>"]}}' \
  --region us-west-2

# ビルド & デプロイ
agentcore deploy
```

### 更新デプロイ

```bash
agentcore deploy --auto-update-on-conflict
```

`--auto-update-on-conflict` を付けると、既存の Runtime 設定（JWT 認証、環境変数など）を維持したまま更新されます。

### 確認

```bash
agentcore status
```

ステータスが `READY` になれば成功です。

## フロントエンドとの接続

- フロントエンドとの接続は AgentCore Runtime の HTTP POST `/invocations` エンドポイント + SSE ストリーミング経由
- Amplify コンソールで `NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN` を設定してフロントエンドから接続
- **sandbox 環境での結合テストは不可**（Cognito が異なるため）
- 結合テストは Amplify develop 環境で行う

## 注意事項

- Python 3.10 以上が必要
- シークレットは `.env` に記載し、コミットしない（.gitignore で除外済み）
- `agentcore deploy` で `--auto-update-on-conflict` を省略すると authorizer 設定がリセットされる可能性あり
- Amplify のビルド環境は Docker 非対応のため、AgentCore を Amplify の CDK スタックに含めない
