/**
 * Chrome ブックマークインポート機能の型定義
 *
 * Netscape Bookmark File Format のパース結果、重複チェック結果、
 * バッチ処理の進捗・結果などを表現する。
 */

/**
 * パース済みブックマークエントリ
 *
 * Netscape Bookmark File Format の `<DT><A>` タグから抽出される 1 件分のデータ。
 */
export interface ParsedBookmark {
  /** HREF 属性から取得した URL */
  url: string;
  /** `<A>` タグのテキストコンテンツから取得したタイトル */
  title: string;
  /** ADD_DATE 属性から取得した UNIX timestamp（任意） */
  addDate?: number;
  /** ルートからのフォルダパス（ネスト順） */
  folderPath: string[];
}

/**
 * パース済みフォルダ構造
 *
 * `<DT><H3>` タグから抽出されるフォルダ情報。
 */
export interface ParsedFolder {
  /** フォルダ名（`<H3>` のテキストコンテンツ） */
  name: string;
  /** ルートからのフルパス（親フォルダを含む） */
  path: string[];
  /** このフォルダ直下のブックマーク件数 */
  bookmarkCount: number;
}

/**
 * パース結果
 *
 * `parseNetscapeBookmarkFile` が返す集約情報。
 */
export interface ParseResult {
  /** 抽出されたすべてのブックマーク */
  bookmarks: ParsedBookmark[];
  /** 抽出されたすべてのフォルダ */
  folders: ParsedFolder[];
  /** パース対象のブックマーク総件数 */
  totalCount: number;
  /** http/https スキームの有効な件数 */
  validCount: number;
  /** 無効スキームでスキップされた件数 */
  skippedCount: number;
}

/**
 * 重複検出結果
 *
 * インポート対象と既存 Bookmark を突き合わせた結果。
 */
export interface DuplicateCheckResult {
  /** 既存 Bookmark と URL が一致した URL 一覧 */
  duplicateUrls: string[];
  /** 重複件数 */
  duplicateCount: number;
  /** 重複していない新規件数 */
  newCount: number;
}

/**
 * 重複 URL の処理戦略
 *
 * - `skip`: 重複 URL はインポートせず、新規のみ作成する
 * - `merge`: 重複 URL の既存 Bookmark のタイトル・Collection 紐付けを更新する
 */
export type DuplicateStrategy = "skip" | "merge";

/**
 * インポート処理の進行状態
 */
export type ImportStatus =
  | "idle"
  | "parsing"
  | "checking_duplicates"
  | "importing"
  | "fetching_ogp"
  | "completed"
  | "error";

/**
 * インポート進捗
 *
 * UI のプログレスバーや統計表示に使用する。
 */
export interface ImportProgress {
  status: ImportStatus;
  /** 処理済みの Bookmark 件数 */
  processedCount: number;
  /** 処理対象の全件数 */
  totalCount: number;
  /** 進捗率（0-100） */
  percentage: number;
  /** 推定残り秒数（未算出時は null） */
  estimatedRemainingSeconds: number | null;
  /** 現在処理中のバッチ番号（1-indexed） */
  currentBatch: number;
  /** 全バッチ数 */
  totalBatches: number;
}

/**
 * インポート結果サマリー
 *
 * インポート完了時に表示する成績情報。
 */
export interface ImportResult {
  /** 新規作成に成功した Bookmark 件数 */
  successCount: number;
  /** 重複スキップされた Bookmark 件数 */
  skippedCount: number;
  /** 作成に失敗した Bookmark 件数 */
  failedCount: number;
  /** 新規作成された Collection 件数 */
  createdCollections: number;
  /** 失敗した Bookmark の URL 一覧 */
  failedUrls: string[];
  /** インポート処理の所要時間（ミリ秒） */
  duration: number;
}
