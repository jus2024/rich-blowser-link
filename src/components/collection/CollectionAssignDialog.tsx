"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bookmark, CollectionNode } from "@/src/types";
import styles from "./CollectionAssignDialog.module.css";

export interface CollectionAssignDialogProps {
  /** 振り分け対象の Bookmark */
  bookmark: Bookmark;
  /** ツリー構造の Collection 一覧 */
  collectionTree: CollectionNode[];
  /** Collection を割り当てるハンドラ（null = 未分類） */
  onAssign: (collectionId: string | null) => Promise<void>;
  /** ダイアログを閉じるハンドラ */
  onClose: () => void;
}

/**
 * ブックマークを Collection に振り分けるダイアログ（1対1版）。
 *
 * - ラジオボタンで1つの Collection を選択する
 * - 「未分類」選択肢を先頭に表示
 * - ツリー構造をインデントで表現
 * - 選択後「完了」ボタンで確定
 */
export function CollectionAssignDialog({
  bookmark,
  collectionTree,
  onAssign,
  onClose,
}: CollectionAssignDialogProps) {
  const [selected, setSelected] = useState<string | null>(bookmark.collectionId ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onAssign(selected);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  }, [selected, onAssign, onClose]);

  // ダイアログ外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Escape キーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ツリーノードを再帰的にレンダリング
  function renderNodes(nodes: CollectionNode[]): React.ReactNode {
    return nodes.map((node) => (
      <li key={node.id}>
        <label
          className={styles.label}
          style={{ paddingLeft: `${1.25 + node.depth * 1.25}rem` }}
        >
          <input
            type="radio"
            name="collection"
            className={styles.radio}
            value={node.id}
            checked={selected === node.id}
            onChange={() => setSelected(node.id)}
          />
          <span className={styles.collectionName}>{node.name}</span>
        </label>
        {node.children.length > 0 && (
          <ul className={styles.subList}>{renderNodes(node.children)}</ul>
        )}
      </li>
    ));
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Collection に振り分け">
      <div className={styles.dialog} ref={dialogRef}>
        <div className={styles.header}>
          <h3 className={styles.title}>Collection に振り分け</h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <p className={styles.bookmarkTitle}>
          {bookmark.title || bookmark.url}
        </p>

        <ul className={styles.list}>
          {/* 未分類 */}
          <li>
            <label className={`${styles.label} ${styles.uncategorized}`}>
              <input
                type="radio"
                name="collection"
                className={styles.radio}
                value=""
                checked={selected === null}
                onChange={() => setSelected(null)}
              />
              <span className={styles.collectionName}>未分類</span>
            </label>
          </li>
          {renderNodes(collectionTree)}
        </ul>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isProcessing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={styles.doneButton}
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "処理中…" : "完了"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CollectionAssignDialog;
