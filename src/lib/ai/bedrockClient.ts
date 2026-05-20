/**
 * Amazon Bedrock クライアントモジュール
 *
 * AWS SDK v3 の @aws-sdk/client-bedrock-runtime を使用して
 * InvokeModel API を呼び出す。IAM 認証は実行環境のクレデンシャルを自動使用する。
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { BedrockClientConfig } from "./types";

/**
 * BedrockRuntimeClient を設定に基づいて初期化する。
 * IAM 認証は環境から自動解決される（ハードコードしない）。
 */
export function createBedrockClient(
  config: BedrockClientConfig,
): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: config.region,
  });
}

/**
 * Bedrock InvokeModel API を呼び出し、モデルのテキスト応答を返す。
 *
 * - Anthropic Messages API フォーマット（Claude モデル）を使用
 * - AbortSignal.timeout によるタイムアウト制御
 * - エラーは呼び出し元に伝播する（ここではキャッチしない）
 */
export async function invokeModel(
  client: BedrockRuntimeClient,
  prompt: string,
  config: BedrockClientConfig,
): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: config.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command, {
    abortSignal: AbortSignal.timeout(config.timeout),
  });

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Anthropic Messages API のレスポンス形式からテキストを抽出
  const content = responseBody.content;
  if (Array.isArray(content) && content.length > 0 && content[0].type === "text") {
    return content[0].text;
  }

  return "";
}
