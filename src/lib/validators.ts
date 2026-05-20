/**
 * 入力バリデーション関数群
 *
 * Bookmark / Tag / Collection などの入力値を検証するための純粋関数を
 * 集約するモジュール。副作用を持たせず、検証結果を {@link ValidationResult}
 * として返すことでフォームや API クライアントから再利用しやすくする。
 *
 * このファイルには今後以下の関数が追加される:
 * - validateTagName (Task 2.3)
 * - validateCollectionName / validateCollectionDescription (Task 2.5)
 * - validateBookmarkEdit (Task 2.7)
 */

/** 検証結果。失敗時は `error` にユーザー向けメッセージを含める。 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** URL の最大文字数。Requirements 1.1, 1.7 参照。 */
const URL_MAX_LENGTH = 2048;

/** 有効と見なすプロトコル（http/https のみ）。 */
const ALLOWED_PROTOCOLS = new Set<string>(["http:", "https:"]);

/**
 * URL 入力を検証する。
 *
 * 判定ルール:
 * - 空文字列（前後の空白除去後）は無効
 * - 文字列長が 2048 文字を超える場合は無効
 * - `URL` コンストラクタで解釈できない（RFC 3986 非準拠）文字列は無効
 * - スキームが `http:` または `https:` 以外の場合は無効
 *
 * Validates: Requirements 1.1, 1.7
 */
export function validateUrl(input: string): ValidationResult {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { valid: false, error: "URL を入力してください" };
  }

  if (input.length > URL_MAX_LENGTH) {
    return {
      valid: false,
      error: `URL は ${URL_MAX_LENGTH} 文字以内で入力してください`,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { valid: false, error: "URL の形式が正しくありません" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      valid: false,
      error: "URL は http または https で始まる必要があります",
    };
  }

  return { valid: true };
}

/** Tag 名の最小文字数。Requirements 4.5 参照。 */
const TAG_NAME_MIN_LENGTH = 1;

/** Tag 名の最大文字数。Requirements 4.5 参照。 */
const TAG_NAME_MAX_LENGTH = 30;

/**
 * Tag 名の入力を検証する。
 *
 * 判定ルール:
 * - 文字列型でない、または長さが 0（空文字列）の場合は無効
 * - 文字数が 30 を超える場合は無効
 * - 1〜30 文字の場合は有効
 *
 * 前後の空白はトリムせずにそのまま長さを評価する。トリム仕様が必要な場合は
 * 呼び出し側で事前処理することを想定する。
 *
 * Validates: Requirements 4.5
 */
export function validateTagName(input: string): ValidationResult {
  if (typeof input !== "string" || input.length < TAG_NAME_MIN_LENGTH) {
    return { valid: false, error: "タグ名を入力してください" };
  }

  if (input.length > TAG_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `タグ名は ${TAG_NAME_MAX_LENGTH} 文字以内で入力してください`,
    };
  }

  return { valid: true };
}

/** Collection 名の最小文字数。Requirements 5.1 参照。 */
const COLLECTION_NAME_MIN_LENGTH = 1;

/** Collection 名の最大文字数。Requirements 5.1 参照。 */
const COLLECTION_NAME_MAX_LENGTH = 100;

/** Collection 説明の最大文字数。Requirements 5.6 参照。 */
const COLLECTION_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Collection 名の入力を検証する。
 *
 * 判定ルール:
 * - 文字列型でない、または長さが 0（空文字列）の場合は無効
 * - 文字数が 100 を超える場合は無効
 * - 1〜100 文字の場合は有効
 *
 * 前後の空白はトリムせずにそのまま長さを評価する。トリム仕様が必要な場合は
 * 呼び出し側で事前処理することを想定する。
 *
 * Validates: Requirements 5.1
 */
export function validateCollectionName(input: string): ValidationResult {
  if (typeof input !== "string" || input.length < COLLECTION_NAME_MIN_LENGTH) {
    return { valid: false, error: "Collection 名を入力してください" };
  }

  if (input.length > COLLECTION_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Collection 名は ${COLLECTION_NAME_MAX_LENGTH} 文字以内で入力してください`,
    };
  }

  return { valid: true };
}

/**
 * Collection の説明文の入力を検証する。
 *
 * 判定ルール:
 * - 文字列型でない場合は無効
 * - 文字数が 500 を超える場合は無効
 * - 0〜500 文字の場合は有効（空文字列は有効）
 *
 * 説明は任意入力のため空文字列を有効として扱う。
 *
 * Validates: Requirements 5.6
 */
export function validateCollectionDescription(input: string): ValidationResult {
  if (typeof input !== "string") {
    return { valid: false, error: "Collection の説明は文字列で入力してください" };
  }

  if (input.length > COLLECTION_DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: `Collection の説明は ${COLLECTION_DESCRIPTION_MAX_LENGTH} 文字以内で入力してください`,
    };
  }

  return { valid: true };
}
/** Bookmark タイトルの最小文字数。Requirements 3.1, 3.2 参照。 */
const BOOKMARK_TITLE_MIN_LENGTH = 1;

/** Bookmark タイトルの最大文字数。Requirements 3.1 参照。 */
const BOOKMARK_TITLE_MAX_LENGTH = 200;

/** Bookmark 説明の最大文字数。Requirements 3.1 参照。 */
const BOOKMARK_DESCRIPTION_MAX_LENGTH = 1000;

/** Bookmark メモの最大文字数。Requirements 3.1 参照。 */
const BOOKMARK_MEMO_MAX_LENGTH = 2000;

/** Bookmark 編集フォームの入力値。 */
export interface BookmarkEditInput {
  title: string;
  description: string;
  memo: string;
}

/**
 * Bookmark 編集フォームの検証結果。
 *
 * 失敗時は `errors` オブジェクトにフィールドごとのメッセージを格納する。
 * 単一フィールドで短絡せず、すべてのフィールドを評価してエラーを集約する
 * ため、フォーム UI 側でまとめてエラー表示できる。
 */
export interface BookmarkEditValidationResult {
  valid: boolean;
  errors: {
    title?: string;
    description?: string;
    memo?: string;
  };
}

/**
 * Bookmark 編集の入力を検証する。
 *
 * 判定ルール:
 * - `title`: 1〜200 文字。空文字列（または非文字列）および 200 文字超は無効
 * - `description`: 0〜1000 文字（空文字列は有効）。1000 文字超は無効
 * - `memo`: 0〜2000 文字（空文字列は有効）。2000 文字超は無効
 *
 * すべてのフィールドを評価し、エラーを集約して返す（短絡評価を行わない）。
 * 文字数は前後の空白をトリムせずに評価する。トリム仕様が必要な場合は
 * 呼び出し側で事前処理することを想定する。
 *
 * Validates: Requirements 3.1, 3.2
 */
export function validateBookmarkEdit(
  input: BookmarkEditInput,
): BookmarkEditValidationResult {
  const errors: BookmarkEditValidationResult["errors"] = {};

  if (
    typeof input.title !== "string" ||
    input.title.length < BOOKMARK_TITLE_MIN_LENGTH
  ) {
    errors.title = "タイトルを入力してください";
  } else if (input.title.length > BOOKMARK_TITLE_MAX_LENGTH) {
    errors.title = `タイトルは ${BOOKMARK_TITLE_MAX_LENGTH} 文字以内で入力してください`;
  }

  if (typeof input.description !== "string") {
    errors.description = "説明は文字列で入力してください";
  } else if (input.description.length > BOOKMARK_DESCRIPTION_MAX_LENGTH) {
    errors.description = `説明は ${BOOKMARK_DESCRIPTION_MAX_LENGTH} 文字以内で入力してください`;
  }

  if (typeof input.memo !== "string") {
    errors.memo = "メモは文字列で入力してください";
  } else if (input.memo.length > BOOKMARK_MEMO_MAX_LENGTH) {
    errors.memo = `メモは ${BOOKMARK_MEMO_MAX_LENGTH} 文字以内で入力してください`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
