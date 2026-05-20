"use client";

import { useEffect } from "react";
import type { Bookmark } from "@/src/types";
import styles from "./DuplicateDialog.module.css";

export interface DuplicateDialogProps {
  isOpen: boolean;
  existingBookmark: Bookmark | null;
  /** 続行（重複を許容して保存を進める） */
  onContinue: () => void;
  /** 中止（保存をキャンセル） */
  onCancel: () => void;
}

/**
 * 重複 URL 検出時に続行 / 中止を選択させるモーダルダイアログ。
 *
 * - Requirements 1.5: 重複している旨を示すメッセージと続行/中止の選択肢を提示する
 * - Requirements 1.6: 中止を選択した場合は Bookmark を作成せず入力画面の状態を維持する
 */
export function DuplicateDialog({
  isOpen,
  existingBookmark,
  onContinue,
  onCancel,
}: DuplicateDialogProps) {
  // ESC キーで中止扱いにする
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const displayTitle =
    existingBookmark?.title && existingBookmark.title.trim().length > 0
      ? existingBookmark.title
      : "(タイトル未設定)";

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        // オーバーレイクリックは中止扱い（カード内クリックは伝播させない）
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="重複 URL 確認ダイアログ"
      >
        <h2 className={styles.title}>重複 URL の確認</h2>
        <p className={styles.message}>この URL は既に保存されています。</p>

        {existingBookmark && (
          <div className={styles.existing}>
            <span className={styles.existingLabel}>既存の Bookmark</span>
            <div className={styles.existingTitle}>{displayTitle}</div>
            <div className={styles.existingUrl}>{existingBookmark.url}</div>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            中止
          </button>
          <button
            type="button"
            className={styles.continueButton}
            onClick={onContinue}
          >
            続けて保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default DuplicateDialog;
