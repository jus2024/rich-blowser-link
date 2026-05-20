"use client";

import { useMemo, useState } from "react";
import type { Collection, CollectionInput } from "@/src/types";
import {
  validateCollectionDescription,
  validateCollectionName,
} from "@/src/lib/validators";
import styles from "./CollectionForm.module.css";

export interface CollectionFormProps {
  /** 編集対象の Collection。渡された場合は編集モード、省略時は新規作成モード。 */
  collection?: Collection;
  /** 親 Collection 選択用の全 Collection 一覧（フラット）。省略時は親選択UIを非表示。 */
  collections?: Collection[];
  /** 新規作成時のデフォルト親 Collection ID */
  defaultParentId?: string | null;
  onSubmit: (input: CollectionInput) => Promise<void>;
  onCancel: () => void;
}

/**
 * Collection 作成 / 編集フォームコンポーネント。
 *
 * - 作成モード（`collection` 未指定）: 名前・説明ともに空から入力。
 * - 編集モード（`collection` 指定）: 既存値をプレフィル。
 *
 * バリデーション:
 * - 名前は {@link validateCollectionName}（1〜100 文字）
 * - 説明は {@link validateCollectionDescription}（0〜500 文字、空は許可）
 *
 * バリデーション不通過時および送信中は送信ボタンを無効化する。各フィールド
 * 直下にインラインでエラーメッセージを表示する。送信時は `onSubmit` の
 * rejection を捕捉し、フォーム下部のエラーバナーにメッセージを表示する
 * （Requirement 5.8 の名前一意性エラーは親が throw することでここに表示される）。
 *
 * Validates Requirements: 5.1, 5.6, 5.8
 */
export function CollectionForm({
  collection,
  collections,
  defaultParentId,
  onSubmit,
  onCancel,
}: CollectionFormProps) {
  const isEditMode = collection !== undefined;

  const [name, setName] = useState<string>(collection?.name ?? "");
  const [description, setDescription] = useState<string>(
    collection?.description ?? "",
  );
  const [parentId, setParentId] = useState<string | null>(
    collection?.parentId ?? defaultParentId ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** 名前のバリデーション結果。入力変更ごとに再評価。 */
  const nameValidation = useMemo(() => validateCollectionName(name), [name]);

  /** 説明のバリデーション結果。入力変更ごとに再評価。 */
  const descriptionValidation = useMemo(
    () => validateCollectionDescription(description),
    [description],
  );

  const isFormValid = nameValidation.valid && descriptionValidation.valid;

  // 初期状態で「Collection 名を入力してください」エラーを即時表示しないため、
  // 名前に 1 文字以上入力された場合のみエラーを表示する。
  const showNameError = !nameValidation.valid && name.length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    const data: CollectionInput = {
      name,
      description,
      parentId: parentId ?? null,
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(data);
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

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.title}>
        {isEditMode ? "Collection を編集" : "Collection を作成"}
      </h2>

      {collections && collections.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="collection-form-parent" className={styles.label}>
            親 Collection
          </label>
          <select
            id="collection-form-parent"
            className={styles.input}
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value || null)}
            disabled={isSubmitting}
          >
            <option value="">なし（ルートレベル）</option>
            {collections
              .filter((c) => c.id !== collection?.id) // 自分自身は除外
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="collection-form-name" className={styles.label}>
          名前
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        </label>        <input
          id="collection-form-name"
          type="text"
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: あとで読む"
          aria-required="true"
          aria-invalid={showNameError || undefined}
          aria-describedby={
            showNameError ? "collection-form-name-error" : undefined
          }
          disabled={isSubmitting}
          autoComplete="off"
        />
        {showNameError && (
          <p
            id="collection-form-name-error"
            className={styles.error}
            role="alert"
          >
            {nameValidation.error}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="collection-form-description" className={styles.label}>
          説明
        </label>
        <textarea
          id="collection-form-description"
          className={styles.textarea}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="任意（最大 500 文字）"
          aria-invalid={!descriptionValidation.valid || undefined}
          aria-describedby={
            !descriptionValidation.valid
              ? "collection-form-description-error"
              : undefined
          }
          disabled={isSubmitting}
        />
        {!descriptionValidation.valid && (
          <p
            id="collection-form-description-error"
            className={styles.error}
            role="alert"
          >
            {descriptionValidation.error}
          </p>
        )}
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

export default CollectionForm;
