/**
 * 共通型定義
 *
 * プロジェクト全体で使う型をここに追加してください。
 */

/** API レスポンスの汎用ラッパー */
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

/** チャットメッセージの送信者 */
export type MessageRole = "user" | "assistant";

/** チャットメッセージ */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** Bookmark ステータス */
export type BookmarkStatus = "inbox" | "read" | "archived";

/** 表示モード */
export type DisplayMode = "list" | "grid" | "compact";

/** ソートキー */
export type SortKey = "createdAt" | "lastAccessedAt" | "accessCount" | "sortOrder";

/**
 * Bookmark エンティティ
 *
 * ユーザーが保存する URL とそのメタデータ（OGP 情報、メモなど）。
 * Amplify Data の owner-based authorization で所有者ごとにデータ分離される。
 */
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  memo: string;
  ogpImageUrl: string;
  status: BookmarkStatus;
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  isReadable: boolean;
  sortOrder: number;
  pinned: boolean;
  collectionId: string | null;  // 所属 Collection（null = 未分類）
}
/**
 * Bookmark 作成/編集用の入力型
 *
 * url は必須、その他は任意（未指定時は空文字列など既定値を使用）。
 */
export interface BookmarkInput {
  url: string;
  title?: string;
  description?: string;
  memo?: string;
  ogpImageUrl?: string;
  isReadable?: boolean;
  sortOrder?: number;
  pinned?: boolean;
  collectionId?: string | null;
}

/**
 * Tag エンティティ
 *
 * Bookmark に付与される自由入力のラベル。1 つの Bookmark に複数付与可能。
 */
export interface Tag {
  id: string;
  name: string;
  owner: string;
}

/**
 * Bookmark 数付きの Tag
 *
 * Tag フィルター UI での件数表示などに使用する。
 */
export interface TagWithCount extends Tag {
  bookmarkCount: number;
}

/**
 * Collection エンティティ
 *
 * Bookmark をグループ化するためのフォルダ的な分類単位。
 * parentId が null のものがルートレベル。最大3段の階層をサポート。
 */
export interface Collection {
  id: string;
  name: string;
  description: string;
  parentId: string | null;  // null = ルートレベル
  owner: string;
}

/**
 * Collection 作成/編集用の入力型
 */
export interface CollectionInput {
  name: string;
  description?: string;
  parentId?: string | null;  // null または未指定 = ルートレベル
}

/**
 * ツリー表示用の Collection ノード
 */
export interface CollectionNode extends Collection {
  children: CollectionNode[];
  depth: number;  // 0 = ルート, 1 = 子, 2 = 孫（最大）
}

/**
 * Bookmark と Tag の中間テーブルレコード（多対多）
 */
export interface BookmarkTag {
  id: string;
  bookmarkId: string;
  tagId: string;
  owner: string;
}

/**
 * Bookmark と Collection の中間テーブルレコード（多対多）
 */
export interface BookmarkCollection {
  id: string;
  bookmarkId: string;
  collectionId: string;
  owner: string;
}

/**
 * OGP メタデータ
 *
 * URL から取得した Open Graph Protocol 情報。
 */
export interface OGPData {
  title: string;
  description: string;
  imageUrl: string;
}
