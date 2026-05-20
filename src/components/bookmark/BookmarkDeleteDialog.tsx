"use client";

import { useEffect } from "react";
import type { Bookmark } from "@/src/types";
import { getDisplayTitle } from "@/src/lib/ogpUtils";
import styles from "./BookmarkDeleteDialog.module.css";

export interface BookmarkDeleteDialogProps {
  isOpen: boolean;
  bookmark: Bookmark | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Bookmark 削除の確認モーダルダイアログ。
 *
 * - Requirements 3.3: 削除前に確認ダイアログで誤操作を防ぐ
 * - Requirements 3.4: キャンセルを選択した場合は削除しない
 */
export function BookmarkDeleteDialog({
  isOpen,
  bookmark,
  onConfirm,
  onCancel,
}: BookmarkDeleteDialogProps) {
  // ESC キーでキャンセル扱いにする
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

  if (!isOpen || !bookmark) {
    return null;
  }

  const displayTitle = getDisplayTitle(bookmark);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        // オーバーレイクリックはキャンセル扱い（カード内クリックは伝播させない）
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Bookmark 削除確認ダイアログ"
      >
        <h2 className={styles.title}>Bookmark を削除</h2>
        <p className={styles.message}>この Bookmark を削除しますか？</p>

        <div className={styles.bookmarkInfo}>
          <div className={styles.bookmarkTitle}>{displayTitle}</div>
          <div className={styles.bookmarkUrl}>{bookmark.url}</div>
        </div>

        <p className={styles.warning}>
          この操作は取り消せません。Tag や Collection の紐付けも削除されます。
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onConfirm}
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookmarkDeleteDialog;
