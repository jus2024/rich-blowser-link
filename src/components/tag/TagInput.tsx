"use client";

import { useMemo, useState } from "react";
import type { Tag } from "@/src/types";
import { validateTagName } from "@/src/lib/validators";
import { getTagSuggestions } from "@/src/lib/tagUtils";
import { TagBadge } from "./TagBadge";
import styles from "./TagInput.module.css";

/** 1 つの Bookmark に付与できる Tag 数の上限。Requirements 4.1 参照。 */
const DEFAULT_MAX_TAGS = 20;

export interface TagInputProps {
  /**
   * 現在選択済みの Tag 名（重複なし）を保持する配列。
   * ラベル表示と重複チェックに利用する。
   */
  selectedTags: string[];
  /** 選択済み Tag 配列の変更通知。 */
  onChange: (tags: string[]) => void;
  /**
   * オートコンプリート候補を生成するための既存 Tag 一覧。
   * 未指定時はオートコンプリートを行わない。
   */
  availableTags?: Tag[];
  /**
   * 付与できる Tag 数の上限。既定値は 20。
   * Requirements 4.1 に基づき、既定で 1 つの Bookmark に最大 20 個まで。
   */
  maxTags?: number;
}

/**
 * オートコンプリート付きの Tag 入力コンポーネント。
 *
 * - 選択済み Tag は {@link TagBadge} で表示し、× ボタンで個別に解除できる
 * - テキスト入力で新しい Tag を入力し、Enter キー押下で追加する
 *   - `validateTagName` で 1〜30 文字にバリデーション（Requirements 4.5）
 *   - すでに選択済みの Tag（大小区別なし比較）は追加しない
 *   - 上限に達している場合は追加しない
 * - 入力値に前方一致する既存 Tag を最大 10 件サジェスト表示する（Requirements 4.2）
 *   - サジェスト項目のクリックで即時選択され、入力はクリアされる
 *   - すでに選択済みの Tag はサジェストから除外する
 * - 選択済み件数が上限以上の場合はテキスト入力を無効化し、
 *   上限に達している旨のメッセージを表示する
 *
 * Validates Requirements: 4.1, 4.2, 4.5
 */
export function TagInput({
  selectedTags,
  onChange,
  availableTags,
  maxTags = DEFAULT_MAX_TAGS,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const atLimit = selectedTags.length >= maxTags;

  /**
   * 選択済み Tag の小文字集合。重複チェックに使用する。
   * 大小文字の違いを同一視したいので lowercase で保持する。
   */
  const selectedLowerSet = useMemo(() => {
    const set = new Set<string>();
    for (const name of selectedTags) {
      set.add(name.toLowerCase());
    }
    return set;
  }, [selectedTags]);

  /**
   * 入力値に前方一致する既存 Tag のサジェスト候補。
   * - `availableTags` 未指定時は空配列
   * - 入力が空の場合は空配列（getTagSuggestions の仕様）
   * - すでに選択済みの Tag は候補から除外
   * - 表示上限は getTagSuggestions 内で 10 件に制限されるため、
   *   選択済みを除外した後は 10 件以下になる
   */
  const suggestions = useMemo<Tag[]>(() => {
    if (!availableTags || availableTags.length === 0) {
      return [];
    }
    const raw = getTagSuggestions(availableTags, inputValue);
    return raw.filter((tag) => !selectedLowerSet.has(tag.name.toLowerCase()));
  }, [availableTags, inputValue, selectedLowerSet]);

  /**
   * Tag 名を選択済み配列に追加する。
   * バリデーション・重複チェック・上限チェックを行い、
   * 失敗理由に応じてエラーメッセージを設定する。
   * 追加に成功した場合のみ入力値をクリアする。
   */
  const addTag = (rawName: string): boolean => {
    const trimmed = rawName.trim();
    if (trimmed.length === 0) {
      // 空入力は無視（Enter を単に押しただけのケース）
      return false;
    }

    const validation = validateTagName(trimmed);
    if (!validation.valid) {
      setErrorMessage(validation.error ?? "タグ名が不正です");
      return false;
    }

    if (selectedLowerSet.has(trimmed.toLowerCase())) {
      setErrorMessage("このタグはすでに追加されています");
      return false;
    }

    if (selectedTags.length >= maxTags) {
      setErrorMessage(`タグは最大 ${maxTags} 個までです`);
      return false;
    }

    onChange([...selectedTags, trimmed]);
    setInputValue("");
    setErrorMessage(null);
    return true;
  };

  const handleRemove = (nameToRemove: string) => {
    onChange(selectedTags.filter((name) => name !== nameToRemove));
    // 上限エラーで止まっていた場合に備えてエラーをクリア
    setErrorMessage(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // フォーム送信を抑止し、Tag 追加として処理する
      event.preventDefault();
      addTag(inputValue);
    }
  };

  const handleSuggestionClick = (name: string) => {
    addTag(name);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    // 入力中は過去のエラーを消す
    if (errorMessage !== null) {
      setErrorMessage(null);
    }
  };

  const showSuggestions = suggestions.length > 0 && !atLimit;

  return (
    <div className={styles.container}>
      {selectedTags.length > 0 && (
        <div className={styles.badges} role="list" aria-label="選択済みタグ">
          {selectedTags.map((name) => (
            <span role="listitem" key={name}>
              <TagBadge label={name} onRemove={() => handleRemove(name)} />
            </span>
          ))}
        </div>
      )}

      <div className={styles.inputWrapper}>
        <input
          type="text"
          className={styles.input}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            atLimit
              ? "タグ数が上限に達しています"
              : "タグ名を入力して Enter で追加"
          }
          disabled={atLimit}
          aria-label="タグを追加"
          aria-invalid={errorMessage !== null || undefined}
          autoComplete="off"
        />

        {showSuggestions && (
          <ul className={styles.suggestions} role="listbox">
            {suggestions.map((tag) => (
              <li key={tag.id} role="option" aria-selected="false">
                <button
                  type="button"
                  className={styles.suggestion}
                  onMouseDown={(event) => {
                    // input の blur より先にクリックを処理するため mousedown を使う
                    event.preventDefault();
                    handleSuggestionClick(tag.name);
                  }}
                >
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorMessage !== null && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}

      {atLimit && errorMessage === null && (
        <p className={styles.limitMessage}>
          タグは最大 {maxTags} 個までです
        </p>
      )}
    </div>
  );
}

export default TagInput;
