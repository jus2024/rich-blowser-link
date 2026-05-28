/**
 * AI Bookmark Enrichment - 型定義と定数
 */

// --- Interfaces ---

/** AI 補完 API へのリクエスト */
export interface EnrichmentRequest {
  url: string;
  ogpTitle?: string;
  ogpDescription?: string;
}

/** AI 補完 API のレスポンス */
export interface EnrichmentResult {
  suggestedTags: string[];      // 最大1個、各最大30文字
  suggestedMemo: string;        // 最大300文字
  suggestedTitle: string;       // 最大200文字（OGPタイトルが空の場合のみ生成）
  suggestedDescription: string; // 最大500文字（OGP説明が空の場合のみ生成）
  suggestedCollection: string;  // 既存 Collection 名（該当なしなら空文字）
}

/** プロンプト構築用のコンテキスト */
export interface PromptContext {
  url: string;
  ogpTitle: string;
  ogpDescription: string;
  existingTags?: string[];
  existingCollections?: string[];
}

/** Bedrock クライアント設定 */
export interface BedrockClientConfig {
  modelId: string;    // from BEDROCK_MODEL_ID
  region: string;     // from BEDROCK_REGION
  timeout: number;    // 8000ms
}

// --- フィールド制約の定数 ---

export const MAX_TAGS = 1;
export const MAX_TAG_LENGTH = 30;
export const MAX_MEMO_LENGTH = 300;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 500;

// --- インポート時 Collection モード ---

/** インポート時の Collection 取り扱いモード */
export type ImportCollectionMode = "folder-inherit" | "flat";

// --- 空デフォルト値 ---

/** Bedrock 呼び出し失敗、JSON パース失敗、環境変数未設定時に返すデフォルト */
export const EMPTY_ENRICHMENT: EnrichmentResult = {
  suggestedTags: [],
  suggestedMemo: "",
  suggestedTitle: "",
  suggestedDescription: "",
  suggestedCollection: "",
};
