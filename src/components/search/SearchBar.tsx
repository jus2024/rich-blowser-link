"use client";

import styles from "./SearchBar.module.css";

/** 検索キーワードの最大文字数。Requirements 6.1, 6.5 参照。 */
const SEARCH_MAX_LENGTH = 200;

export interface SearchBarProps {
  /** 現在の検索キーワード（入力中の生の値）。 */
  query: string;
  /** 検索キーワードの変更通知。 */
  onQueryChange: (q: string) => void;
  /** デバウンス待ちまたは検索実行中かどうか。 */
  isSearching: boolean;
  /**
   * 直近の検索結果件数。
   * `null` / `undefined` は「まだ検索結果が確定していない」ことを表し、
   * 0 件メッセージは表示しない。
   */
  resultCount?: number | null;
}

/**
 * 検索キーワード入力用のプレゼンテーショナルコンポーネント。
 *
 * - 入力フィールドは `query` にバインドされ、変更時に `onQueryChange` を呼ぶ
 * - 文字数上限は 200（Requirements 6.1 / 6.5）
 * - `query` が 1 文字以上ある場合にクリアボタン（×）を表示し、
 *   押下で `onQueryChange("")` を呼ぶ
 * - `isSearching` が true の間は右側に「検索中...」のインジケーターを表示
 * - `query` が 1 文字以上、かつ検索中でなく、結果が 0 件のとき
 *   「該当する Bookmark がありません」と表示する（Requirements 6.4）
 *
 * デバウンス処理自体は呼び出し側の `useSearch` フックが担当し、
 * 本コンポーネントは状態を持たない制御コンポーネントとして動作する。
 *
 * Validates Requirements: 6.1, 6.2, 6.4
 */
export function SearchBar({
  query,
  onQueryChange,
  isSearching,
  resultCount,
}: SearchBarProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  const handleClear = () => {
    onQueryChange("");
  };

  const hasQuery = query.length > 0;
  const showClearButton = hasQuery && !isSearching;
  const showNoResults =
    hasQuery && !isSearching && resultCount === 0;

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <input
          type="search"
          role="searchbox"
          className={styles.input}
          value={query}
          onChange={handleChange}
          placeholder="Bookmark を検索..."
          maxLength={SEARCH_MAX_LENGTH}
          aria-label="Bookmark 検索"
          autoComplete="off"
        />

        {isSearching && (
          <span className={styles.indicator} aria-live="polite">
            検索中...
          </span>
        )}

        {showClearButton && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            aria-label="検索キーワードをクリア"
          >
            ×
          </button>
        )}
      </div>

      {showNoResults && (
        <p className={styles.noResults} role="status">
          該当する Bookmark がありません
        </p>
      )}
    </div>
  );
}

export default SearchBar;
