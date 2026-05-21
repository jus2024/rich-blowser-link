"use client";

import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAgentChat } from "@/src/hooks/useAgentChat";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface AgentChatSectionProps {
  runtimeArn: string | undefined;
  /** エージェントのレスポンス完了時に呼ばれるコールバック */
  onResponseComplete?: () => void;
}

/**
 * Bookmark 検索用エージェントチャット UI セクション。
 *
 * AgentCore Runtime との HTTP SSE 通信により、自然言語で Bookmark を検索できる。
 *
 * - NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN 未設定時: Runtime 未設定メッセージを表示し入力を無効化 (Req 9.8)
 * - 通信エラー時: エラーメッセージを表示し会話履歴を維持 (Req 9.9)
 * - 未認証時: チャット機能を無効化 (Req 9.10)
 * - 認証トークンは各リクエストに付与 (Req 9.10, useAgentChat 内で処理)
 */
export default function AgentChatSection({ runtimeArn, onResponseComplete }: AgentChatSectionProps) {
  const { messages, isLoading, error, sendMessage, resetSession } = useAgentChat(runtimeArn, { onResponseComplete });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isRuntimeConfigured = !!runtimeArn?.trim();

  // 認証状態を確認
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // Amplify 未設定時は認証チェックをスキップ（開発時の利便性）
      if (!isAmplifyConfigured()) {
        setIsAuthenticated(true);
        return;
      }

      try {
        const session = await fetchAuthSession();
        if (!cancelled) {
          setIsAuthenticated(!!session.tokens?.accessToken);
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // 入力を無効化する条件
  const isInputDisabled =
    isLoading || !isRuntimeConfigured || isAuthenticated === false;

  return (
    <section
      aria-labelledby="agent-chat-heading"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.25rem",
        }}
      >
        <h2
          id="agent-chat-heading"
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            margin: 0,
          }}
        >
          AI Bookmark 検索
        </h2>
        <button
          type="button"
          onClick={resetSession}
          disabled={isLoading}
          aria-label="新しい会話を開始"
          style={{
            fontSize: "0.75rem",
            padding: "0.25rem 0.5rem",
            borderRadius: "var(--radius, 0.375rem)",
            border: "1px solid var(--color-border, #d1d5db)",
            backgroundColor: "transparent",
            color: "var(--color-text-secondary, #6b7280)",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          新しい会話
        </button>
      </div>
      <p
        style={{
          color: "var(--color-text-secondary, #6b7280)",
          marginBottom: "0.75rem",
          lineHeight: 1.5,
          fontSize: "0.85rem",
        }}
      >
        自然言語で Bookmark を検索できます。「XXXのリンクどれだっけ？」のように質問してください。
      </p>

      {!isRuntimeConfigured && (
        <div
          role="status"
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #93c5fd",
            color: "#1e40af",
            borderRadius: "var(--radius, 0.5rem)",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          AgentCore Runtime が設定されていません。
          <code style={{ fontSize: "0.8rem" }}>NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN</code>{" "}
          環境変数を設定するとチャット機能が有効になります。
        </div>
      )}

      {isAuthenticated === false && (
        <div
          role="status"
          style={{
            backgroundColor: "#fefce8",
            border: "1px solid #fde047",
            color: "#854d0e",
            borderRadius: "var(--radius, 0.5rem)",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          チャット機能を利用するにはログインが必要です。
        </div>
      )}

      <MessageList messages={messages} />

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            borderRadius: "var(--radius, 0.5rem)",
            padding: "0.75rem 1rem",
            marginTop: "0.75rem",
            marginBottom: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          エラーが発生しました: {error}
        </div>
      )}

      <div style={{ marginTop: "0.75rem" }}>
        <MessageInput
          onSend={sendMessage}
          disabled={isInputDisabled}
        />
      </div>
    </section>
  );
}
