"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./QuickAdd.module.css";

export interface QuickAddProps {
  /** URL とオプションのタイトルを受け取ってブックマークを作成するハンドラ */
  onAdd: (url: string, title?: string) => Promise<void>;
  /** 重複チェック（既に登録済みの場合は Bookmark を返す） */
  checkDuplicate?: (url: string) => Promise<unknown>;
}

/**
 * URLを入力してEnterで即登録するクイックブックマーク追加コンポーネント。
 */
export function QuickAdd({ onAdd, checkDuplicate }: QuickAddProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || isAdding) return;

    // 簡易URL検証
    try {
      const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        showMessage("error", "http/https のURLを入力してください");
        return;
      }
    } catch {
      showMessage("error", "有効なURLを入力してください");
      return;
    }

    const finalUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

    setIsAdding(true);
    try {
      // 重複チェック
      if (checkDuplicate) {
        const existing = await checkDuplicate(finalUrl);
        if (existing) {
          showMessage("error", "このURLは既に登録されています");
          setIsAdding(false);
          return;
        }
      }

      const trimmedTitle = title.trim();
      await onAdd(finalUrl, trimmedTitle || undefined);
      setUrl("");
      setTitle("");
      showMessage("success", "登録しました");
      inputRef.current?.focus();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setIsAdding(false);
    }
  }, [url, title, isAdding, onAdd, checkDuplicate, showMessage]);

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URLを貼り付けてEnterで登録..."
        disabled={isAdding}
        aria-label="クイックブックマーク登録"
      />
      <input
        type="text"
        className={styles.titleInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル（任意）"
        maxLength={200}
        disabled={isAdding}
        aria-label="ブックマークタイトル"
      />
      <button
        type="submit"
        className={styles.button}
        disabled={!url.trim() || isAdding}
      >
        {isAdding ? "..." : "+"}
      </button>
      {message && (
        <span className={message.type === "success" ? styles.success : styles.error}>
          {message.text}
        </span>
      )}
    </form>
  );
}

export default QuickAdd;
