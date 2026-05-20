"use client";

import { useState, useRef, useEffect } from "react";
import type { Collection } from "@/src/types";
import styles from "./CollectionAssignDropdown.module.css";

export interface CollectionAssignDropdownProps {
  /** 対象の Bookmark ID */
  bookmarkId: string;
  /** 全 Collection 一覧 */
  collections: Collection[];
  /** 当該 Bookmark が既に割り当てられている Collection ID の配列 */
  assignedCollectionIds: string[];
  /** Collection にチェックを追加した際のコールバック */
  onAssign: (collectionId: string) => Promise<void>;
  /** Collection のチェックを解除した際のコールバック */
  onUnassign: (collectionId: string) => Promise<void>;
}

/**
 * Bookmark の Collection 割り当てドロップダウン。
 *
 * - 要件 4.1: 全 Collection のチェックボックス付きドロップダウンを表示し、
 *   割り当て済み Collection にチェックを入れた状態で表示する。
 * - 要件 4.2: チェック追加時に onAssign を呼び出す。
 * - 要件 4.3: チェック解除時に onUnassign を呼び出す。
 */
export function CollectionAssignDropdown({
  bookmarkId,
  collections,
  assignedCollectionIds,
  onAssign,
  onUnassign,
}: CollectionAssignDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleItemClick = async (collectionId: string) => {
    const isAssigned = assignedCollectionIds.includes(collectionId);
    if (isAssigned) {
      await onUnassign(collectionId);
    } else {
      await onAssign(collectionId);
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Bookmark ${bookmarkId} の Collection 割り当て`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        振り分け
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox" aria-label="Collection 一覧">
          {collections.length === 0 ? (
            <p className={styles.emptyMessage}>Collection がありません</p>
          ) : (
            collections.map((collection) => {
              const isAssigned = assignedCollectionIds.includes(collection.id);
              return (
                <button
                  key={collection.id}
                  type="button"
                  className={styles.checkboxItem}
                  role="option"
                  aria-selected={isAssigned}
                  onClick={() => handleItemClick(collection.id)}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isAssigned}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <span className={styles.collectionName}>
                    {collection.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default CollectionAssignDropdown;
