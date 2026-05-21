"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";
import { countBookmarksPerTag, getTagSuggestions } from "@/src/lib/tagUtils";
import { validateTagName } from "@/src/lib/validators";
import type { BookmarkTag, Tag, TagWithCount } from "@/src/types";

/**
 * useTags フックの戻り値インターフェース
 *
 * Tag の CRUD、オートコンプリート、Bookmark への Tag 付与/解除を
 * 一元的に扱う。Amplify Data が未設定（`amplify_outputs.json` が無い）
 * 環境では、参照系は空配列を返し、変更系は
 * `"Amplify is not configured"` エラーで失敗する。
 *
 * Validates: Requirements 4.1, 4.2, 4.6, 4.7
 */
export interface UseTagsReturn {
  tags: TagWithCount[];
  /** Bookmark と Tag の中間テーブル全件（tagsByBookmarkId の構築に使用） */
  bookmarkTags: BookmarkTag[];
  suggestions: Tag[];
  getSuggestions: (prefix: string) => void;
  createTag: (name: string) => Promise<Tag>;
  renameTag: (id: string, newName: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  addTagToBookmark: (tagId: string, bookmarkId: string) => Promise<void>;
  removeTagFromBookmark: (tagId: string, bookmarkId: string) => Promise<void>;
}

type TagModel = Schema["Tag"]["type"];
type BookmarkTagModel = Schema["BookmarkTag"]["type"];

/** Amplify 未設定時に変更系 API が送出するエラーメッセージ。 */
const NOT_CONFIGURED_MESSAGE = "Amplify is not configured";

/**
 * Amplify 側のモデルオブジェクトをアプリ共通の {@link Tag} 型へ整形する。
 *
 * `owner` フィールドは `allow.owner()` により自動付与される管理フィールドで、
 * 生成される型上は `string | null | undefined` 相当。`Tag.owner` は
 * `string` 必須のため、未設定時は空文字列にフォールバックする。
 */
function toTag(model: TagModel): Tag {
  const owner = (model as { owner?: string | null }).owner ?? "";
  return {
    id: model.id,
    name: model.name,
    owner,
  };
}

/**
 * Amplify 側の中間テーブルレコードをアプリ共通の
 * {@link BookmarkTag} 型へ整形する。`owner` の扱いは {@link toTag} と同様。
 */
function toBookmarkTag(model: BookmarkTagModel): BookmarkTag {
  const owner = (model as { owner?: string | null }).owner ?? "";
  return {
    id: model.id,
    bookmarkId: model.bookmarkId,
    tagId: model.tagId,
    owner,
  };
}

/**
 * `BookmarkTag` を条件で検索し、`nextToken` を辿って全件取得したうえで
 * `id` の配列として返す。
 *
 * 削除対象の一括収集に使用する純粋な補助関数として切り出しており、
 * ループ内で `nextToken` を自己代入することによる
 * TypeScript の自己参照型推論エラーを避ける。
 */
async function listAllBookmarkTagIds(
  client: ReturnType<typeof generateClient<Schema>>,
  filter: { bookmarkId?: string; tagId?: string },
): Promise<string[]> {
  const conditions: Array<{ bookmarkId?: { eq: string }; tagId?: { eq: string } }> = [];
  if (filter.bookmarkId !== undefined) {
    conditions.push({ bookmarkId: { eq: filter.bookmarkId } });
  }
  if (filter.tagId !== undefined) {
    conditions.push({ tagId: { eq: filter.tagId } });
  }

  const ids: string[] = [];
  let token: string | undefined = undefined;
  while (true) {
    const res: {
      data: Array<{ id: string }>;
      nextToken?: string | null;
    } = await client.models.BookmarkTag.list({
      filter: { and: conditions },
      limit: 1000,
      nextToken: token,
    });
    for (const row of res.data) {
      ids.push(row.id);
    }
    if (!res.nextToken) break;
    token = res.nextToken;
  }
  return ids;
}

/**
 * Tag の CRUD・オートコンプリート・Bookmark 紐付けを提供するカスタムフック。
 *
 * - 参照系: `client.models.Tag` / `BookmarkTag` を `observeQuery` で購読し、
 *   リアクティブに `tags`（件数付き）を算出する。
 * - オートコンプリート: `getSuggestions(prefix)` を呼ぶと、内部の `tags`
 *   から前方一致候補を `suggestions` に反映する（最大 10 件）。
 * - 変更系: `createTag` / `renameTag` は {@link validateTagName} で
 *   1〜30 文字制約を検証。`deleteTag` は中間テーブルの該当行を先に
 *   削除してから Tag 本体を削除する。
 * - 付与/解除: `addTagToBookmark` は冪等（既に存在すれば何もしない）。
 *   `removeTagFromBookmark` は (bookmarkId, tagId) に一致する全行を削除する。
 */
export function useTags(): UseTagsReturn {
  const [client] = useState(() =>
    isAmplifyConfigured() ? generateClient<Schema>() : null,
  );
  const [rawTags, setRawTags] = useState<Tag[]>([]);
  const [rawBookmarkTags, setRawBookmarkTags] = useState<BookmarkTag[]>([]);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);

  useEffect(() => {
    if (!client) return;
    const tagSub = client.models.Tag.observeQuery().subscribe({
      next: ({ items }) => setRawTags(items.filter((i) => i != null).map(toTag)),
    });
    const bookmarkTagSub = client.models.BookmarkTag.observeQuery().subscribe({
      next: ({ items }) => setRawBookmarkTags(items.filter((i) => i != null).map(toBookmarkTag)),
    });
    return () => {
      tagSub.unsubscribe();
      bookmarkTagSub.unsubscribe();
    };
  }, [client]);

  const tags = useMemo<TagWithCount[]>(
    () => countBookmarksPerTag(rawTags, rawBookmarkTags),
    [rawTags, rawBookmarkTags],
  );

  const getSuggestions = useCallback(
    (prefix: string) => {
      setSuggestions(getTagSuggestions(rawTags, prefix));
    },
    [rawTags],
  );

  const createTag = useCallback(
    async (name: string): Promise<Tag> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }
      const v = validateTagName(name);
      if (!v.valid) {
        throw new Error(v.error ?? "Invalid tag name");
      }

      // 一意性チェック: 同名タグが既に存在する場合はそれを返す（大文字小文字区別なし）
      const existing = rawTags.find(
        (t) => t.name.toLowerCase() === name.trim().toLowerCase(),
      );
      if (existing) {
        return existing;
      }

      const res = await client.models.Tag.create({ name: name.trim() });
      if (!res.data) {
        throw new Error(
          res.errors?.[0]?.message ?? "Failed to create tag",
        );
      }
      return toTag(res.data);
    },
    [client, rawTags],
  );

  const renameTag = useCallback(
    async (id: string, newName: string): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }
      const v = validateTagName(newName);
      if (!v.valid) {
        throw new Error(v.error ?? "Invalid tag name");
      }

      const res = await client.models.Tag.update({ id, name: newName });
      if (!res.data) {
        throw new Error(
          res.errors?.[0]?.message ?? "Failed to rename tag",
        );
      }
    },
    [client],
  );

  const deleteTag = useCallback(
    async (id: string): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const middleTableRowIds = await listAllBookmarkTagIds(client, {
        tagId: id,
      });

      await Promise.all(
        middleTableRowIds.map((rowId) =>
          client.models.BookmarkTag.delete({ id: rowId }),
        ),
      );

      const res = await client.models.Tag.delete({ id });
      if (!res.data) {
        throw new Error(
          res.errors?.[0]?.message ?? "Failed to delete tag",
        );
      }
    },
    [client],
  );

  const addTagToBookmark = useCallback(
    async (tagId: string, bookmarkId: string): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const existing = await client.models.BookmarkTag.list({
        filter: {
          and: [
            { bookmarkId: { eq: bookmarkId } },
            { tagId: { eq: tagId } },
          ],
        },
        limit: 1,
      });
      if (existing.data.length > 0) {
        return;
      }

      const res = await client.models.BookmarkTag.create({
        bookmarkId,
        tagId,
      });
      if (!res.data) {
        throw new Error(
          res.errors?.[0]?.message ?? "Failed to add tag to bookmark",
        );
      }
    },
    [client],
  );

  const removeTagFromBookmark = useCallback(
    async (tagId: string, bookmarkId: string): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const matchingRowIds = await listAllBookmarkTagIds(client, {
        bookmarkId,
        tagId,
      });

      await Promise.all(
        matchingRowIds.map((rowId) =>
          client.models.BookmarkTag.delete({ id: rowId }),
        ),
      );
    },
    [client],
  );

  return {
    tags,
    bookmarkTags: rawBookmarkTags,
    suggestions,
    getSuggestions,
    createTag,
    renameTag,
    deleteTag,
    addTagToBookmark,
    removeTagFromBookmark,
  };
}
