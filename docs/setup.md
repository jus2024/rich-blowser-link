# セットアップガイド

## 前提条件

- Node.js 20 以上
- npm
- AWS アカウントと認証情報（`aws configure` 済み）
- Git
- Python 3.10+（エージェント機能を使う場合のみ）

## Web アプリのセットアップ

```bash
# リポジトリのクローン
git clone <リポジトリURL>
cd rich-blowser-link

# 依存関係のインストール
npm ci

# 環境変数の設定
cp .env.example .env.local
```

### .env.local の設定

```bash
# AI 補完を有効にする場合（推奨）
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_REGION=us-east-1

# エージェントチャットを有効にする場合（任意、develop 環境でのみ動作）
# NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/...
```

### 開発サーバーの起動

```bash
# ターミナル 1: Amplify sandbox を起動（初回は数分かかります）
npx ampx sandbox

# ターミナル 2: 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスすると Rich Browser Link が動作します。

## 機能別の動作確認

### ブックマーク登録

1. QuickAdd に URL を入力して登録
2. OGP メタデータが自動取得される
3. AI 補完が有効なら、タグ・メモ・タイトル・説明が自動生成される

### インポート

1. ブラウザからブックマークを HTML エクスポート
2. ImportDialog でファイルを選択
3. Collection モード（フォルダ引き継ぎ or フラット）を選択
4. インポート実行 → AI 補完がバッチ処理で全件適用

### AI 補完

- `BEDROCK_MODEL_ID` と `BEDROCK_REGION` が設定されていれば動作
- sandbox 環境でも API Route 経由で Bedrock を呼び出し可能
- AI トグルで ON/OFF 切り替え可能

### エージェントチャット

- **sandbox 環境では動作しません**（Cognito が異なるため）
- ローカルでのエージェント単体テスト: `cd agents && python scripts/run_local.py`
- フロントエンドとの結合テスト: develop ブランチにプッシュして Amplify 環境で確認

## エージェントのセットアップ（任意）

```bash
cd agents
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env
# .env を編集
```

### ローカル動作確認

```bash
python scripts/run_local.py
```

AgentCore Runtime 不要でエージェントのロジックとツールを直接テストできます。

## テスト

```bash
# ユニットテスト（Vitest）
npx vitest --run

# 型チェック
npx tsc --noEmit

# lint
npx next lint

# エージェントのテスト（Python）
cd agents
python -m pytest
```

## 注意事項

- `.env.local` や `agents/.env` はコミットしないでください（.gitignore で除外済み）
- Amplify sandbox は開発用の一時的なバックエンド環境を作成します
- sandbox の Cognito と AgentCore Runtime の Cognito は異なるため、sandbox 環境でのエージェント結合テストは不可です
- AI 補完（Bedrock 呼び出し）は sandbox 環境でも動作します（API Route 経由のため）
