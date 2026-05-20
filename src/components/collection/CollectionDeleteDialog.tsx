"use client";

import { useEffect } from "react";
import styles from "./CollectionDeleteDialog.module.css";

export interface CollectionDeleteDialogProps {
  collectionName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Collection 削除の確認モーダルダイアログ。
 *
 * - Requirements 3.1: 削除アクション選択時に確認ダイアログを表示する
 * - Requirements 3.3: キャンセルを選択した場合は Collection を削除せず元の状態を維持する
 */
export function CollectionDeleteDialog({
  collectionName,
  isOpen,
  onConfirm,
  onCancel,
}: CollectionDeleteDialogProps) {
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

  if (!isOpen) {
    return null;
  }

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
        aria-label="Collection 削除確認ダイアログ"
      >
        <h2 className={styles.title}>Collection を削除</h2>
        <p className={styles.message}>
          この Collection を削除しますか？所属する Bookmark は削除されません。
        </p>

        <div className={styles.collectionInfo}>
          <div className={styles.collectionName}>{collectionName}</div>
        </div>

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
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

export default CollectionDeleteDialog;
