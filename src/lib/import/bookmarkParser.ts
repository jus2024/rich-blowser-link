/**
 * Netscape Bookmark File Format パーサー
 *
 * Google Chrome 等がエクスポートする `<!DOCTYPE NETSCAPE-Bookmark-file-1>` で始まる
 * HTML 文字列をパースし、ブックマーク・フォルダ構造を抽出する。
 *
 * このモジュールはフォーマット判定と構造抽出のみを担当する。
 * http/https スキームによる有効性フィルタは別関数（タスク 6.2 の `filterValidBookmarks`）で行う。
 * そのため、`parseNetscapeBookmarkFile` の時点ではすべてのエントリを `bookmarks` に含め、
 * `validCount = totalCount`、`skippedCount = 0` として返す。
 */

import type { ParsedBookmark, ParsedFolder, ParseResult } from "./types";

/**
 * Netscape Bookmark File Format として解釈できない入力に対してスローされるエラー。
 *
 * DOCTYPE ヘッダーが見つからない、あるいは HTML として最低限の構造を満たさない場合に発生する。
 */
export class InvalidFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFormatError";
  }
}

/** DOCTYPE 検証に用いる正規表現（大文字小文字を問わない） */
const NETSCAPE_DOCTYPE_PATTERN = /<!DOCTYPE\s+NETSCAPE-Bookmark-file-1\s*>/i;

/**
 * Netscape Bookmark File Format の HTML 文字列をパースする。
 *
 * @param html - エクスポートされたブックマーク HTML の文字列
 * @returns パース結果（ブックマーク一覧、フォルダ一覧、集計カウント）
 * @throws {InvalidFormatError} DOCTYPE ヘッダーが存在しない、または DOM パースに失敗した場合
 */
export function parseNetscapeBookmarkFile(html: string): ParseResult {
  if (typeof html !== "string" || html.length === 0) {
    throw new InvalidFormatError(
      "入力が空です。Netscape Bookmark File Format の HTML を指定してください。",
    );
  }

  if (!NETSCAPE_DOCTYPE_PATTERN.test(html)) {
    throw new InvalidFormatError(
      "DOCTYPE ヘッダー <!DOCTYPE NETSCAPE-Bookmark-file-1> が見つかりません。",
    );
  }

  if (typeof DOMParser === "undefined") {
    throw new InvalidFormatError(
      "DOMParser が利用できない環境ではパースできません。",
    );
  }

  const document = new DOMParser().parseFromString(html, "text/html");

  const rootDl = document.querySelector("dl");
  const bookmarks: ParsedBookmark[] = [];
  const folders: ParsedFolder[] = [];

  if (rootDl) {
    traverseDl(rootDl, [], bookmarks, folders);
  }

  const totalCount = bookmarks.length;

  return {
    bookmarks,
    folders,
    totalCount,
    // 有効スキームのフィルタリングは filterValidBookmarks（タスク 6.2）で行う。
    // この関数ではフィルタ適用前の値として validCount = totalCount, skippedCount = 0 を返す。
    validCount: totalCount,
    skippedCount: 0,
  };
}

/**
 * `<DL>` 要素の直下の `<DT>` を順に走査し、フォルダ（`<H3>`）とブックマーク（`<A>`）を抽出する。
 *
 * Netscape 形式では、フォルダに属するブックマークが格納される `<DL>` は
 * 対応する `<DT>` の次の兄弟として現れる場合と、`<DT>` の内側にネストされる場合がある。
 * どちらのパターンも扱えるよう両方を探索する。
 *
 * @param dl - 現在走査対象の `<DL>` 要素
 * @param currentPath - 現時点でのフォルダパススタック（ルートからの順序）
 * @param bookmarks - 抽出された ParsedBookmark を追記する配列
 * @param folders - 抽出された ParsedFolder を追記する配列
 */
function traverseDl(
  dl: Element,
  currentPath: string[],
  bookmarks: ParsedBookmark[],
  folders: ParsedFolder[],
): void {
  const children = Array.from(dl.children);

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.tagName.toLowerCase() !== "dt") {
      continue;
    }

    const h3 = findDirectChildByTag(child, "h3");
    if (h3) {
      const folderName = (h3.textContent ?? "").trim();
      const folderPath = [...currentPath, folderName];

      // フォルダ直下のブックマーク件数は、配下の DL の直接の <DT><A> 数から数える。
      const childDl = findFolderContentsDl(child, children, i);
      const directBookmarkCount = childDl
        ? countDirectBookmarks(childDl)
        : 0;

      folders.push({
        name: folderName,
        path: folderPath,
        bookmarkCount: directBookmarkCount,
      });

      if (childDl) {
        traverseDl(childDl, folderPath, bookmarks, folders);
      }
      continue;
    }

    const anchor = findDirectChildByTag(child, "a");
    if (anchor) {
      const url = anchor.getAttribute("href") ?? "";
      const title = (anchor.textContent ?? "").trim();
      const addDateAttr = anchor.getAttribute("add_date");
      const addDateNum = addDateAttr !== null ? parseInt(addDateAttr, 10) : NaN;

      const parsed: ParsedBookmark = {
        url,
        title,
        folderPath: [...currentPath],
      };
      if (Number.isFinite(addDateNum)) {
        parsed.addDate = addDateNum;
      }

      bookmarks.push(parsed);
    }
  }
}

/**
 * 指定された `<DT>` に対して、フォルダ配下のブックマークを含む `<DL>` を返す。
 *
 * 1. `<DT>` の内側に `<DL>` がネストされているケース
 * 2. `<DT>` の次以降の兄弟として `<DL>` が現れるケース
 *
 * のいずれかを許容する。どちらも見つからない場合は null。
 */
function findFolderContentsDl(
  dt: Element,
  siblings: Element[],
  dtIndex: number,
): Element | null {
  const nested = findDirectChildByTag(dt, "dl");
  if (nested) {
    return nested;
  }

  for (let j = dtIndex + 1; j < siblings.length; j += 1) {
    const next = siblings[j];
    const tag = next.tagName.toLowerCase();
    if (tag === "dl") {
      return next;
    }
    if (tag === "dt") {
      // 次のエントリに到達したので終了
      break;
    }
  }
  return null;
}

/**
 * `<DL>` 直下の `<DT><A>` の数を数える（ネストされたフォルダ配下は含めない）。
 */
function countDirectBookmarks(dl: Element): number {
  let count = 0;
  for (const child of Array.from(dl.children)) {
    if (child.tagName.toLowerCase() !== "dt") {
      continue;
    }
    const anchor = findDirectChildByTag(child, "a");
    const h3 = findDirectChildByTag(child, "h3");
    if (anchor && !h3) {
      count += 1;
    }
  }
  return count;
}

/**
 * 指定タグ名の直接の子要素を返す。見つからない場合は null。
 */
function findDirectChildByTag(
  parent: Element,
  tagName: string,
): Element | null {
  const target = tagName.toLowerCase();
  for (const child of Array.from(parent.children)) {
    if (child.tagName.toLowerCase() === target) {
      return child;
    }
  }
  return null;
}

/**
 * ParsedBookmark 配列を URL スキームで分類する。
 *
 * - `valid`: `new URL(b.url)` が成功し、プロトコルが `http:` または `https:` のもの
 * - `skipped`: URL のパースに失敗した、または上記以外のスキームを持つもの
 *
 * 入力順序は `valid` / `skipped` のそれぞれで保持される。
 * 常に `valid.length + skipped.length === bookmarks.length` が成立する。
 *
 * Validates: Requirements 10.13
 *
 * @param bookmarks - 分類対象の ParsedBookmark 配列
 * @returns `valid` と `skipped` の 2 つの配列を持つオブジェクト
 */
export function filterValidBookmarks(bookmarks: ParsedBookmark[]): {
  valid: ParsedBookmark[];
  skipped: ParsedBookmark[];
} {
  const valid: ParsedBookmark[] = [];
  const skipped: ParsedBookmark[] = [];

  for (const bookmark of bookmarks) {
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(bookmark.url);
    } catch {
      parsedUrl = null;
    }

    if (
      parsedUrl !== null &&
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:")
    ) {
      valid.push(bookmark);
    } else {
      skipped.push(bookmark);
    }
  }

  return { valid, skipped };
}

/** Collection 名の最大文字数（Requirement 5.1 と整合） */
const COLLECTION_NAME_MAX_LENGTH = 100;

/**
 * フォルダパスを最大深さに切り詰める。
 * インポート時に3段を超えるパスを3段に制限する。
 */
export function truncateFolderPath(folderPath: string[], maxDepth = 3): string[] {
  return folderPath.slice(0, maxDepth);
}

/**
 * フォルダパス配列をフラットな Collection 名に変換する（後方互換用）。
 * @deprecated 新規コードでは truncateFolderPath + 階層 Collection 作成を使うこと
 */
export function buildCollectionName(folderPath: string[]): string {
  const joined = folderPath.join("/");
  if (joined.length > COLLECTION_NAME_MAX_LENGTH) {
    return joined.slice(0, COLLECTION_NAME_MAX_LENGTH);
  }
  return joined;
}
