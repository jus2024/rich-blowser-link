"use client";

import { useMemo, useState } from "react";
import type { Bookmark, BookmarkInput } from "@/src/types";
import {
  validateBookmarkEdit,
  validateUrl,
  type BookmarkEditValidationResult,
} from "@/src/lib/validators";
import styles from "./BookmarkForm.module.css";

export interface BookmarkFormProps {
  /** 編集対象の Bookmark。渡された場合は編集モード、省略時は新規作成モード。 */
  bookmark?: Bookmark;
  /**
   * 送信ハンドラ。バリデーションを通過した BookmarkInput と
   * Tag 名配列（カンマ区切り入力からパースされたもの）を受け取り、
   * 永続化を Promise で実行する。
   */
  onSubmit: (data: BookmarkInput, tags: string[]) => Promise<void>;
  /** キャンセルハンドラ。フォームを閉じる契機として呼び出される。 */
  onCancel: () => void;
  /** 編集モード時の初期 Tag 名配列。未指定時は空として扱う。 */
  initialTags?: string[];
}

/**
 * 空の編集バリデーション結果（作成モード用）。
 */
const EMPTY_EDIT_VALIDATION: BookmarkEditValidationResult = {
  valid: true,
  errors: {},
};

/**
 * Bookmark 作成 / 編集フォームコンポーネント。
 *
 * - 作成モード（`bookmark` 未指定）: URL のみ必須。タイトル・説明・メモ・タグは任意。
 *   URL は {@link validateUrl} でバリデーションする。
 * - 編集モード（`bookmark` 指定）: 全フィールドをプレフィルし、URL も編集可能。
 *   URL は {@link validateUrl}、タイトル・説明・メモは {@link validateBookmarkEdit} でバリデーションする。
 *
 * バリデーション不通過時は送信ボタンを無効化し、各フィールド直下にインラインで
 * エラーメッセージを表示する。送信中は送信ボタンに「保存中...」と表示する。
 *
 * Tag 入力は現時点ではカンマ区切りのシンプルな `<input>` を使用する。
 * オートコンプリート付きの TagInput は Task 11.1 で実装予定。
 *
 * Validates Requirements: 1.1, 1.7, 3.1, 3.2
 */
export function BookmarkForm({
  bookmark,
  onSubmit,
  onCancel,
  initialTags,
}: BookmarkFormProps) {
  const isEditMode = bookmark !== undefined;

  const [url, setUrl] = useState<string>(bookmark?.url ?? "");
  const [title, setTitle] = useState<string>(bookmark?.title ?? "");
  const [description, setDescription] = useState<string>(
    bookmark?.description ?? "",
  );
  const [memo, setMemo] = useState<string>(bookmark?.memo ?? "");
  const [tagsText, setTagsText] = useState<string>(
    (initialTags ?? []).join(", "),
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** URL のバリデーション結果。入力変更ごとに再評価。 */
  const urlValidation = useMemo(() => validateUrl(url), [url]);

  /**
   * タイトル・説明・メモのバリデーション結果。
   * 作成モードでは常に有効扱いとする（Requirements の対象が編集時のため）。
   */
  const editValidation = useMemo<BookmarkEditValidationResult>(() => {
    if (!isEditMode) {
      return EMPTY_EDIT_VALIDATION;
    }
    return validateBookmarkEdit({ title, description, memo });
  }, [isEditMode, title, description, memo]);

  const isFormValid = urlValidation.valid && editValidation.valid;

  /**
   * Tag 入力文字列を正規化して Tag 名配列に変換する。
   * カンマで分割し、前後空白をトリムし、空文字列を除去し、重複を排除する。
   */
  const parsedTags = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of tagsText.split(",")) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
    }
    return result;
  }, [tagsText]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    const data: BookmarkInput = {
      url,
      title,
      description,
      memo,
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(data, parsedTags);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : "保存に失敗しました。しばらくしてから再試行してください。",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 入力初期状態で「URL を入力してください」エラーを出さないため、
  // URL に 1 文字以上入力された場合のみエラー表示を行う。
  const showUrlError = !urlValidation.valid && url.length > 0;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.title}>
        {isEditMode ? "Bookmark を編集" : "Bookmark を作成"}
      </h2>

      <div className={styles.field}>
        <label htmlFor="bookmark-form-url" className={styles.label}>
          URL<span className={styles.required} aria-hidden="true">*</span>
        </label>
        <input
          id="bookmark-form-url"
          type="url"
          className={styles.input}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          aria-required="true"
          aria-invalid={showUrlError || undefined}
          aria-describedby={showUrlError ? "bookmark-form-url-error" : undefined}
          disabled={isSubmitting}
          autoComplete="off"
        />
        {showUrlError && (
          <p
            id="bookmark-form-url-error"
            className={styles.error}
            role="alert"
          >
            {urlValidation.error}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="bookmark-form-title" className={styles.label}>
          タイトル
          {isEditMode && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
        <input
          id="bookmark-form-title"
          type="text"
          className={styles.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            isEditMode
              ? "例: ニュースサイト"
              : "任意（OGP から自動取得されます）"
          }
          aria-required={isEditMode || undefined}
          aria-invalid={editValidation.errors.title ? true : undefined}
          aria-describedby={
            editValidation.errors.title
              ? "bookmark-form-title-error"
              : undefined
          }
          disabled={isSubmitting}
        />
        {editValidation.errors.title && (
          <p
            id="bookmark-form-title-error"
            className={styles.error}
            role="alert"
          >
            {editValidation.errors.title}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="bookmark-form-description" className={styles.label}>
          説明
        </label>
        <textarea
          id="bookmark-form-description"
          className={styles.textarea}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          aria-invalid={editValidation.errors.description ? true : undefined}
          aria-describedby={
            editValidation.errors.description
              ? "bookmark-form-description-error"
              : undefined
          }
          disabled={isSubmitting}
        />
        {editValidation.errors.description && (
          <p
            id="bookmark-form-description-error"
            className={styles.error}
            role="alert"
          >
            {editValidation.errors.description}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="bookmark-form-memo" className={styles.label}>
          メモ
        </label>
        <textarea
          id="bookmark-form-memo"
          className={styles.textarea}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={4}
          aria-invalid={editValidation.errors.memo ? true : undefined}
          aria-describedby={
            editValidation.errors.memo
              ? "bookmark-form-memo-error"
              : undefined
          }
          disabled={isSubmitting}
        />
        {editValidation.errors.memo && (
          <p
            id="bookmark-form-memo-error"
            className={styles.error}
            role="alert"
          >
            {editValidation.errors.memo}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="bookmark-form-tags" className={styles.label}>
          タグ
        </label>
        {/*
          TODO: Task 11.1 でオートコンプリート付きの TagInput コンポーネントに
          置き換える。現時点ではカンマ区切り文字列をパースする簡易 input とする。
        */}
        <input
          id="bookmark-form-tags"
          type="text"
          className={styles.input}
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="カンマ区切りで入力（例: tech, news, react）"
          disabled={isSubmitting}
          autoComplete="off"
        />
      </div>

      {submitError && (
        <div className={styles.submitError} role="alert">
          {submitError}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? "保存中..." : isEditMode ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}

export default BookmarkForm;
