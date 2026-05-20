import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * Rich Browser Link データモデル定義
 *
 * - Bookmark: ユーザーが保存したリンクと OGP メタデータ
 * - Tag: Bookmark に付与するラベル
 * - BookmarkTag: Bookmark と Tag の多対多中間テーブル
 * - Collection: Bookmark をまとめるフォルダ
 * - BookmarkCollection: Bookmark と Collection の多対多中間テーブル
 *
 * すべてのモデルに owner-based authorization を適用し、
 * Cognito ユーザー ID によるデータ分離を実現する。
 *
 * 参考: https://docs.amplify.aws/nextjs/build-a-backend/data/
 */
const schema = a.schema({
  Bookmark: a
    .model({
      url: a.string().required(),
      title: a.string().default(""),
      description: a.string().default(""),
      memo: a.string().default(""),
      ogpImageUrl: a.string().default(""),
      // --- Read Later / アクセス追跡フィールド ---
      status: a.string().default("inbox"), // "inbox" | "read" | "archived"
      accessCount: a.integer().default(0), // アクセス回数
      lastAccessedAt: a.string().default(""), // ISO 8601 日時（空文字 = 未アクセス）
      // --- ここまで ---
      // --- UX Rich Interactions フィールド ---
      isReadable: a.boolean().default(false), // 読み物系フラグ
      sortOrder: a.integer().default(0), // リスト並び順
      pinned: a.boolean().default(false), // ピン留めフラグ
      collectionId: a.id(),              // 所属 Collection（null = 未分類、1対1）
      // --- ここまで ---
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      tags: a.hasMany("BookmarkTag", "bookmarkId"),
      collections: a.hasMany("BookmarkCollection", "bookmarkId"),
    })
    .authorization((allow) => [allow.owner()]),

  Tag: a
    .model({
      name: a.string().required(),
      bookmarks: a.hasMany("BookmarkTag", "tagId"),
    })
    .authorization((allow) => [allow.owner()]),

  BookmarkTag: a
    .model({
      bookmarkId: a.id().required(),
      tagId: a.id().required(),
      bookmark: a.belongsTo("Bookmark", "bookmarkId"),
      tag: a.belongsTo("Tag", "tagId"),
    })
    .authorization((allow) => [allow.owner()])
    .secondaryIndexes((index) => [
      index("bookmarkId"),
      index("tagId"),
    ]),

  Collection: a
    .model({
      name: a.string().required(),
      description: a.string().default(""),
      parentId: a.id(),                    // null = ルートレベル Collection
      bookmarks: a.hasMany("BookmarkCollection", "collectionId"),
    })
    .authorization((allow) => [allow.owner()]),

  BookmarkCollection: a
    .model({
      bookmarkId: a.id().required(),
      collectionId: a.id().required(),
      bookmark: a.belongsTo("Bookmark", "bookmarkId"),
      collection: a.belongsTo("Collection", "collectionId"),
    })
    .authorization((allow) => [allow.owner()])
    .secondaryIndexes((index) => [
      index("bookmarkId"),
      index("collectionId"),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
