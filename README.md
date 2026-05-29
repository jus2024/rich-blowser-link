# Rich Browser Link

AI 補完付きブックマーク管理 Web アプリケーション。AWS Amplify Gen 2 をバックエンドに、オプションで Strands Agents による AI エージェントチャット機能を備えています。

## 主な機能

- **ブックマーク管理** — URL 登録、OGP メタデータ自動取得、タグ・Collection による整理
- **AI Bookmark Enrichment** — Amazon Bedrock による自動タグ付け（1個）、メモ生成、タイトル・説明補完、Collection 自動振り分け
- **バッチ AI 補完** — インポート時の大量ブックマークに対するキュー方式の全件 AI 補完（OGP → AI 補完の2段パイプライン）
- **ブックマークインポート** — ブラウザエクスポートファイル（HTML）からの一括取り込み、フォルダ構成引き継ぎ or フラットインポート選択
- **Collection & Tag** — 階層 Collection、タグフィルタ、ドラッグ&ドロップ整理、未使用タグ一括削除
- **AI エージェントチャット**（任意）— AgentCore Runtime 上の Strands Agent とリアルタイム対話
- **レスポンシブ対応** — デスクトップ3カラム、モバイルはオーバーレイ展開

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 + TypeScript |
| バックエンド | AWS Amplify Gen 2（AppSync + DynamoDB + Cognito） |
| AI 補完 | Amazon Bedrock（Claude） |
| エージェント（任意） | Python 3.10+ / Strands Agents SDK |
| エージェント実行基盤（任意） | Amazon Bedrock AgentCore Runtime |
| ホスティング | Amplify Hosting |
| テスト | Vitest + React Testing Library |
| IDE 支援 | Kiro |

## ディレクトリ構成

```
src/
  app/                    # Next.js App Router（ページ、API Routes）
    api/ogp/              # OGP メタデータ取得 API
    api/ai-enrich/        # AI 補完 API（Bedrock 呼び出し）
  components/
    agent/                # エージェントチャット UI
    ai/                   # PipelineProgress（OGP + AI 補完統合進捗表示）
    bookmark/             # ブックマーク CRUD コンポーネント
    collection/           # Collection 管理コンポーネント
    import/               # インポートダイアログ
    layout/               # レイアウト（サイドバー、オーバーレイ）
    search/               # 検索バー
    tag/                  # タグフィルタ
    filter/               # ステータスフィルタ
    dnd/                  # ドラッグ&ドロップ
  hooks/                  # カスタムフック
  lib/
    ai/                   # EnrichmentQueue、AI 関連ユーティリティ
    pipeline/             # OGPFetchQueue、RetryHandler（パイプライン基盤）
    agent/                # AgentCore Runtime 通信
    amplify/              # Amplify 設定・プロバイダー
    import/               # インポートパーサー
  types/                  # 型定義
amplify/                  # Amplify Gen 2 バックエンド定義
agents/                   # Strands エージェント（任意）
  bookmark_agent/         # ブックマーク操作エージェント
  common/                 # 共通設定・ログ
  scripts/                # ローカル実行スクリプト
docs/                     # ドキュメント
.kiro/                    # Kiro ワークスペース設定
.github/                  # CI/CD ワークフロー
```

## データモデル

| モデル | 説明 |
|--------|------|
| Bookmark | URL、OGP メタデータ、AI 補完結果、ステータス、ピン留め |
| Tag | ブックマークに付与するラベル |
| BookmarkTag | Bookmark ↔ Tag 多対多中間テーブル |
| Collection | ブックマークをまとめるフォルダ（階層対応） |
| BookmarkCollection | Bookmark ↔ Collection 多対多中間テーブル |

すべてのモデルに owner-based authorization を適用し、Cognito ユーザー ID によるデータ分離を実現しています。

## クイックスタート

### 前提条件

- Node.js 20+
- npm
- AWS アカウントと認証情報（`aws configure` 済み）

### セットアップ

```bash
git clone <リポジトリURL>
cd rich-blowser-link
npm ci
cp .env.example .env.local
# .env.local を編集（BEDROCK_MODEL_ID, BEDROCK_REGION を設定）
```

### 開発サーバーの起動

```bash
# ターミナル 1: Amplify sandbox を起動（初回は数分かかります）
npx ampx sandbox

# ターミナル 2: 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスするとアプリが動作します。

### AI 補完を有効にする

`.env.local` に以下を設定:

```
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_REGION=us-east-1
```

AI 補完は Next.js API Route（`/api/ai-enrich`）経由で Bedrock を呼び出します。sandbox 環境でも動作します。

### エージェントチャットの有効化（任意）

エージェントチャットは AgentCore Runtime へのデプロイが必要です。sandbox の Cognito と AgentCore の Cognito は異なるため、**sandbox 環境での結合テストは不可**です。

エージェント単体のローカル動作確認:

```bash
cd agents
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# ローカルでの動作確認（AgentCore Runtime 不要）
python scripts/run_local.py
```

フロントエンドとの結合テストは Amplify develop 環境で行ってください。詳細は [docs/deployment.md](docs/deployment.md) を参照。

## テスト

```bash
# ユニットテスト
npx vitest --run

# 型チェック
npx tsc --noEmit

# lint
npx next lint
```

## デプロイ

Amplify Hosting（フロントエンド + Cognito）と AgentCore Runtime（エージェント）は別々にデプロイします。

### フロントエンドのデプロイ

```bash
git push origin main  # Amplify Hosting が自動ビルド・デプロイ
```

Amplify コンソールで以下の環境変数を設定:

| キー | 値 |
|------|-----|
| `BEDROCK_MODEL_ID` | Bedrock モデル ID |
| `BEDROCK_REGION` | Bedrock リージョン |
| `NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN` | AgentCore Runtime ARN（任意） |

### エージェントのデプロイ（任意）

```bash
cd agents
agentcore deploy --auto-update-on-conflict
```

詳細な手順は [docs/deployment.md](docs/deployment.md) を参照してください。

## お片付け（リソース削除）

```bash
# Amplify sandbox の停止
npx ampx sandbox delete

# AgentCore Runtime の削除（使っている場合）
cd agents && agentcore destroy
```

Amplify Hosting の削除は AWS コンソールから行います。

## ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| `main` | 本番向け |
| `develop` | 統合ブランチ（結合テスト環境） |
| `feature/*` | 実装作業用 |

## ドキュメント

- [セットアップガイド](docs/setup.md)
- [デプロイガイド](docs/deployment.md)
- [Kiro の使い方](docs/kiro-usage.md)
