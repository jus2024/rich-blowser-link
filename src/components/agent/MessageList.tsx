"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/src/types";

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      role="log"
      aria-live="polite"
      style={{
        overflowY: "auto",
        flex: 1,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {messages.length === 0 && (
        <p style={{ color: "var(--color-text-secondary, #6b7280)", fontSize: "0.9rem" }}>
          メッセージはまだありません。
        </p>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}
        >
          <div
            style={{
              maxWidth: "95%",
              padding: "0.6rem 1rem",
              borderRadius: "0.75rem",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              wordBreak: "break-word",
              backgroundColor: msg.role === "user" ? "#e0f2fe" : "#f3f4f6",
              color: msg.role === "user" ? "#0c4a6e" : "#1f2937",
            }}
          >
            {msg.role === "assistant" ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#2563eb", textDecoration: "underline" }}
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div style={{ overflowX: "auto", margin: "0.5rem 0" }}>
                      <table
                        style={{
                          borderCollapse: "collapse",
                          fontSize: "0.8rem",
                          width: "100%",
                        }}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "0.3rem 0.5rem",
                        backgroundColor: "#e5e7eb",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "0.3rem 0.5rem",
                      }}
                    >
                      {children}
                    </td>
                  ),
                  p: ({ children }) => (
                    <p style={{ margin: "0.3rem 0" }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ margin: "0.3rem 0", paddingLeft: "1.2rem" }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ margin: "0.3rem 0", paddingLeft: "1.2rem" }}>{children}</ol>
                  ),
                  code: ({ children }) => (
                    <code
                      style={{
                        backgroundColor: "#e5e7eb",
                        padding: "0.1rem 0.3rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.85em",
                      }}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
