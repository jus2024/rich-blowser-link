"use client";

import { useCallback, useEffect, useRef } from "react";
import { BookmarkForm } from "./BookmarkForm";
import type { Bookmark, BookmarkInput } from "@/src/types";
import styles from "./BookmarkFormDialog.module.css";

export interface BookmarkFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark?: Bookmark;
  onSubmit: (data: BookmarkInput, tags: string[]) => Promise<void>;
  initialTags?: string[];
}

export function BookmarkFormDialog({
  isOpen,
  onClose,
  bookmark,
  onSubmit,
  initialTags,
}: BookmarkFormDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // ESC キーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ダイアログ表示時にフォーカスを移動
  useEffect(() => {
    if (isOpen && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isOpen]);

  // onSubmit ラッパー: 成功時にダイアログを閉じる
  const handleSubmit = useCallback(
    async (data: BookmarkInput, tags: string[]) => {
      await onSubmit(data, tags);
      onClose();
    },
    [onSubmit, onClose],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={bookmark ? "Bookmark を編集" : "Bookmark を作成"}
        tabIndex={-1}
      >
        <BookmarkForm
          bookmark={bookmark}
          onSubmit={handleSubmit}
          onCancel={onClose}
          initialTags={initialTags}
        />
      </div>
    </div>
  );
}

export default BookmarkFormDialog;
