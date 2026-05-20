"use client";

import type { TagWithCount } from "@/src/types";
import styles from "./TagFilter.module.css";

export interface TagFilterProps {
  tags: TagWithCount[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClear?: () => void;
  /** タグを削除するハンドラ（0件タグの削除用） */
  onDeleteTag?: (tagId: string) => Promise<void>;
}

/**
 * Tag フィルターサイドバー。
 *
 * - 要件 4.3: 複数選択によるブックマークの AND フィルタをトリガする UI を提供する。
 *   実際のフィルタリング（`filterBookmarksByTags`）は呼び出し側で行う。
 * - 要件 4.4: 各 Tag の右側に紐づく Bookmark 数を `(n)` 形式で表示する。
 * - Tag が 1 件も無い場合は案内メッセージを表示する。
 * - 1 件以上選択されている場合のみ「すべて解除」ボタンをヘッダに表示する。
 */
export function TagFilter({
  tags,
  selectedTagIds,
  onToggleTag,
  onClear,
  onDeleteTag,
}: TagFilterProps) {
  const selectedSet = new Set(selectedTagIds);
  const hasSelection = selectedSet.size > 0;

  return (
    <aside className={styles.sidebar} aria-label="Tag フィルター">
      <div className={styles.header}>
        <h2 className={styles.title}>Tags</h2>
        {hasSelection && onClear !== undefined && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClear}
          >
            すべて解除
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <p className={styles.empty} role="status">
          タグがまだ作成されていません
        </p>
      ) : (
        <ul className={styles.list}>
          {tags.map((tag) => {
            const isSelected = selectedSet.has(tag.id);
            return (
              <li key={tag.id}>
                <button
                  type="button"
                  className={
                    isSelected
                      ? `${styles.tagItem} ${styles.tagItemSelected}`
                      : styles.tagItem
                  }
                  onClick={() => onToggleTag(tag.id)}
                  aria-pressed={isSelected}
                >
                  <span className={styles.tagName}>{tag.name}</span>
                  <span className={styles.count}>({tag.bookmarkCount})</span>
                </button>
                {onDeleteTag && tag.bookmarkCount === 0 && (
                  <button
                    type="button"
                    className={styles.deleteTagButton}
                    onClick={() => void onDeleteTag(tag.id)}
                    aria-label={`タグ「${tag.name}」を削除`}
                    title="0件のタグを削除"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default TagFilter;
