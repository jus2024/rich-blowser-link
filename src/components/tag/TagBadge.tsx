"use client";

import styles from "./TagBadge.module.css";

export interface TagBadgeProps {
  /** 表示する Tag 名。Requirements 4.1 */
  label: string;
  /**
   * 削除ボタンのクリックハンドラ。
   * 指定した場合のみ、ラベル右側に × ボタンが表示される。
   * 未指定の場合は単なる表示用バッジとしてレンダリングされる。
   */
  onRemove?: () => void;
}

/**
 * Tag 名を表示するピル型バッジ。
 *
 * - Requirements 4.1: Tag を視覚的に識別しやすい形で表示する
 * - `onRemove` を指定すると、当該 Tag を Bookmark から外すための
 *   × ボタンが末尾に表示される（TagInput 等での利用を想定）
 * - `onRemove` 未指定時は純粋な表示用バッジとして利用できる
 *   （BookmarkCard 等での一覧表示を想定）
 */
export function TagBadge({ label, onRemove }: TagBadgeProps) {
  return (
    <span className={styles.badge}>
      {label}
      {onRemove !== undefined && (
        <button
          type="button"
          className={styles.removeButton}
          onClick={onRemove}
          aria-label={`${label} を削除`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export default TagBadge;
