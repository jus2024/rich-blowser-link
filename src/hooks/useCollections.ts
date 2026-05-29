"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";
import type { Collection, CollectionInput, BookmarkCollection } from "@/src/types";
import { buildCollectionTree, getCollectionDepth } from "@/src/lib/collectionUtils";
import type { CollectionNode } from "@/src/types";
import {
  validateCollectionName,
  validateCollectionDescription,
} from "@/src/lib/validators";

export interface UseCollectionsReturn {
  collections: Collection[];
  /** ツリー構造に変換した Collection（サイドバー表示用） */
  collectionTree: CollectionNode[];
  /** 全 BookmarkCollection 中間テーブルのレコード一覧（後方互換用） */
  bookmarkCollections: BookmarkCollection[];
  createCollection: (input: CollectionInput) => Promise<Collection>;
  updateCollection: (
    id: string,
    input: Partial<CollectionInput>,
  ) => Promise<void>;
  /** Collection の parentId を変更して階層を移動する（ドラッグ&ドロップ用） */
  moveCollection: (id: string, newParentId: string | null) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addBookmarkToCollection: (
    bookmarkId: string,
    collectionId: string,
  ) => Promise<void>;
  removeBookmarkFromCollection: (
    bookmarkId: string,
    collectionId: string,
  ) => Promise<void>;
  /**
   * 指定の Bookmark が指定の Collection に既に割り当てられているか判定する。
   *
   * ドラッグ&ドロップによるコレクション割り当てで、重複割り当てを検出するために
   * 使用する（Requirement 2.5）。
   *
   * Amplify 未設定時は常に false を返す。
   */
  checkBookmarkInCollection: (
    bookmarkId: string,
    collectionId: string,
  ) => Promise<boolean>;
}

type AmplifyClient = ReturnType<typeof generateClient<Schema>>;
type CollectionRecord = Schema["Collection"]["type"];

/**
 * Amplify Data の Collection レコードをアプリ内共通型にマップする。
 *
 * Amplify 側は nullable を許容する（description / owner）ため、
 * UI で扱いやすいよう空文字列に寄せて正規化する。
 */
function mapCollection(record: CollectionRecord): Collection {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? "",
    parentId: (record as Record<string, unknown>).parentId as string | null ?? null,
    owner: record.owner ?? "",
  };
}

function sortCollections(items: Collection[]): Collection[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

/**
 * Collection の CRUD と Bookmark との関連操作を提供するカスタムフック。
 *
 * - ログイン中ユーザーの Collection を `observeQuery` で購読し、状態を自動同期する。
 * - 名前の一意性は Amplify Data が直接保証しないため、
 *   クライアント側で購読中の Collection 集合と照合して作成・更新を拒否する。
 *   観測遅延により同時実行下で重複が作られる余地は残るが、
 *   通常の単一ユーザー操作ではこれで十分な制約となる。
 * - `deleteCollection` は Collection 本体を消す前に関連する
 *   BookmarkCollection を全て削除する（Bookmark 本体は残す）。
 * - `addBookmarkToCollection` は同一 Bookmark × Collection の組み合わせが
 *   既に存在する場合は何もしない（冪等）。
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.7, 5.8
 */
export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [bookmarkCollections, setBookmarkCollections] = useState<BookmarkCollection[]>([]);
  const collectionsRef = useRef<Collection[]>([]);
  const [client] = useState<AmplifyClient | null>(() =>
    isAmplifyConfigured() ? generateClient<Schema>() : null,
  );

  // ミューテーション内で最新の collections スナップショットを参照するために
  // state と同じ値を ref にも保持しておく。useCallback の依存を最小化しつつ、
  // クロージャ経由での古い値参照を避ける。
  useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  // ツリー構造（サイドバー表示用）
  const collectionTree = useMemo(
    () => buildCollectionTree(collections),
    [collections],
  );

  useEffect(() => {
    if (!client) {
      return;
    }

    const sub = client.models.Collection.observeQuery().subscribe({
      next: ({ items }) => {
        setCollections(sortCollections(items.filter((i) => i != null).map(mapCollection)));
      },
      error: (err) => {
        console.error("[useCollections] observeQuery failed", err);
      },
    });

    // BookmarkCollection の購読（件数表示・フィルタ用）
    const bcSub = client.models.BookmarkCollection.observeQuery().subscribe({
      next: ({ items }) => {
        setBookmarkCollections(
          items.filter((r) => r != null).map((r) => ({
            id: r.id,
            bookmarkId: r.bookmarkId,
            collectionId: r.collectionId,
            owner: r.owner ?? "",
          })),
        );
      },
      error: (err) => {
        console.error("[useCollections] BookmarkCollection observeQuery failed", err);
      },
    });

    return () => {
      sub.unsubscribe();
      bcSub.unsubscribe();
    };
  }, [client]);

  // 孤立コレクション（parentId が存在しない ID を指している）の自動修復
  // 初回ロード後に一度だけ実行する
  const orphanFixedRef = useRef(false);
  useEffect(() => {
    if (!client || collections.length === 0 || orphanFixedRef.current) return;
    orphanFixedRef.current = true;

    const ids = new Set(collections.map((c) => c.id));
    const orphans = collections.filter(
      (c) => c.parentId !== null && !ids.has(c.parentId),
    );

    if (orphans.length === 0) return;

    console.log("[useCollections] 孤立コレクションを修復:", orphans.map((c) => c.name));
    Promise.all(
      orphans.map((c) =>
        client.models.Collection.update({ id: c.id, parentId: null }),
      ),
    ).catch((err) => {
      console.error("[useCollections] 孤立修復に失敗:", err);
    });
  }, [client, collections]);

  const createCollection = useCallback(
    async (input: CollectionInput): Promise<Collection> => {
      if (!client) {
        throw new Error(
          "Amplify バックエンドに接続できません。sandbox が起動しているか確認してください。",
        );
      }

      const name = input.name;
      const description = input.description ?? "";
      const parentId = input.parentId ?? null;

      const nameResult = validateCollectionName(name);
      if (!nameResult.valid) {
        throw new Error(nameResult.error ?? "Collection 名が不正です");
      }

      const descriptionResult = validateCollectionDescription(description);
      if (!descriptionResult.valid) {
        throw new Error(
          descriptionResult.error ?? "Collection の説明が不正です",
        );
      }

      // 深さバリデーション（最大3段: depth 0/1/2）
      if (parentId !== null) {
        const collectionsById = new Map(collectionsRef.current.map((c) => [c.id, c]));
        const parentDepth = getCollectionDepth(parentId, collectionsById);
        if (parentDepth >= 2) {
          throw new Error("Collection は最大3段階層まで作成できます（孫の子は作成不可）");
        }
      }

      // 一意性チェック（Requirement 5.8）
      const duplicated = collectionsRef.current.some(
        (existing) => existing.name === name,
      );
      if (duplicated) {
        throw new Error(
          `「${name}」という名前の Collection は既に存在します`,
        );
      }

      const { data, errors } = await client.models.Collection.create({
        name,
        description,
        ...(parentId !== null ? { parentId } : {}),
      });

      if (errors && errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }
      if (!data) {
        throw new Error("Collection の作成に失敗しました");
      }

      return mapCollection(data);
    },
    [client],
  );

  const updateCollection = useCallback(
    async (id: string, input: Partial<CollectionInput>): Promise<void> => {
      if (!client) {
        return;
      }

      const current = collectionsRef.current.find((c) => c.id === id);
      if (!current) {
        throw new Error("対象の Collection が見つかりません");
      }

      const nextName = input.name ?? current.name;
      const nextDescription =
        input.description !== undefined ? input.description : current.description;
      // parentId が明示的に渡された場合のみ更新、未指定なら現在値を維持
      const nextParentId =
        "parentId" in input ? (input.parentId ?? null) : current.parentId;

      const nameResult = validateCollectionName(nextName);
      if (!nameResult.valid) {
        throw new Error(nameResult.error ?? "Collection 名が不正です");
      }

      const descriptionResult = validateCollectionDescription(nextDescription);
      if (!descriptionResult.valid) {
        throw new Error(
          descriptionResult.error ?? "Collection の説明が不正です",
        );
      }

      // 名前が変わる場合のみ、他の Collection と重複しないか確認する
      if (nextName !== current.name) {
        const duplicated = collectionsRef.current.some(
          (existing) => existing.id !== id && existing.name === nextName,
        );
        if (duplicated) {
          throw new Error(
            `「${nextName}」という名前の Collection は既に存在します`,
          );
        }
      }

      // parentId を変更する場合、深さバリデーション
      if (nextParentId !== current.parentId && nextParentId !== null) {
        const collectionsById = new Map(collectionsRef.current.map((c) => [c.id, c]));
        const parentDepth = getCollectionDepth(nextParentId, collectionsById);
        if (parentDepth >= 2) {
          throw new Error("Collection は最大3段階層まで作成できます");
        }
        // 自分の子孫を親にしようとしていないか確認
        if (nextParentId === id) {
          throw new Error("自分自身を親にすることはできません");
        }
      }

      const updatePayload: Record<string, unknown> = {
        id,
        name: nextName,
        description: nextDescription,
      };
      // parentId は null（ルートに移動）も含めて明示的に送る
      if ("parentId" in input) {
        updatePayload.parentId = nextParentId;
      }

      const { errors } = await client.models.Collection.update(
        updatePayload as Parameters<typeof client.models.Collection.update>[0],
      );

      if (errors && errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }
    },
    [client],
  );

  /**
   * Collection の parentId を変更して階層を移動する（ドラッグ&ドロップ用）。
   * newParentId が null の場合はルートレベルに移動する。
   */
  const moveCollection = useCallback(
    async (id: string, newParentId: string | null): Promise<void> => {
      if (!client) return;

      const collectionsById = new Map(collectionsRef.current.map((c) => [c.id, c]));

      // 自分自身への移動は不可
      if (newParentId === id) {
        throw new Error("自分自身を親にすることはできません");
      }

      // 自分の子孫への移動は不可（循環参照防止）
      if (newParentId !== null) {
        let current = collectionsById.get(newParentId);
        const visited = new Set<string>();
        while (current) {
          if (current.id === id) {
            throw new Error("自分の子孫を親にすることはできません");
          }
          if (visited.has(current.id)) break; // 循環参照ガード
          visited.add(current.id);
          current = current.parentId ? collectionsById.get(current.parentId) : undefined;
        }
      }

      // 深さバリデーション
      if (newParentId !== null) {
        const parentDepth = getCollectionDepth(newParentId, collectionsById);
        if (parentDepth >= 2) {
          throw new Error("Collection は最大3段階層まで作成できます");
        }
      }

      const updatePayload = newParentId !== null
        ? { id, parentId: newParentId }
        : { id, parentId: null as unknown as string };

      const { errors } = await client.models.Collection.update(
        updatePayload as Parameters<typeof client.models.Collection.update>[0],
      );

      if (errors && errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }
    },
    [client],
  );

  const deleteCollection = useCallback(
    async (id: string): Promise<void> => {
      if (!client) {
        return;
      }

      // 子コレクションの parentId を null に更新する（孤立防止）
      const childCollections = collectionsRef.current.filter(
        (c) => c.parentId === id,
      );
      if (childCollections.length > 0) {
        const childUpdates = await Promise.all(
          childCollections.map((child) =>
            client.models.Collection.update({ id: child.id, parentId: null }),
          ),
        );
        const childErrors = childUpdates.flatMap((r) => r.errors ?? []);
        if (childErrors.length > 0) {
          throw new Error(childErrors.map((e) => e.message).join(", "));
        }
      }

      // Collection に属する BookmarkCollection を先に削除する
      // （Bookmark 本体は残す。Requirement 5.7）。
      const { data: relations, errors: listErrors } =
        await client.models.BookmarkCollection.list({
          filter: { collectionId: { eq: id } },
        });

      if (listErrors && listErrors.length > 0) {
        throw new Error(listErrors.map((e) => e.message).join(", "));
      }

      if (relations && relations.length > 0) {
        const deletions = await Promise.all(
          relations.map((relation) =>
            client.models.BookmarkCollection.delete({ id: relation.id }),
          ),
        );
        const relationErrors = deletions.flatMap((r) => r.errors ?? []);
        if (relationErrors.length > 0) {
          throw new Error(
            relationErrors.map((e) => e.message).join(", "),
          );
        }
      }

      const { errors } = await client.models.Collection.delete({ id });
      if (errors && errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }
    },
    [client],
  );

  const addBookmarkToCollection = useCallback(
    async (bookmarkId: string, collectionId: string): Promise<void> => {
      if (!client) {
        return;
      }

      // 既に紐付けが存在する場合は何もしない（冪等。Requirement 5.2）。
      const { data: existing, errors: listErrors } =
        await client.models.BookmarkCollection.list({
          filter: {
            and: [
              { bookmarkId: { eq: bookmarkId } },
              { collectionId: { eq: collectionId } },
            ],
          },
        });

      if (listErrors && listErrors.length > 0) {
        throw new Error(listErrors.map((e) => e.message).join(", "));
      }

      if (existing && existing.length > 0) {
        return;
      }

      const { errors } = await client.models.BookmarkCollection.create({
        bookmarkId,
        collectionId,
      });
      if (errors && errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }
    },
    [client],
  );

  const removeBookmarkFromCollection = useCallback(
    async (bookmarkId: string, collectionId: string): Promise<void> => {
      if (!client) {
        return;
      }

      const { data: relations, errors: listErrors } =
        await client.models.BookmarkCollection.list({
          filter: {
            and: [
              { bookmarkId: { eq: bookmarkId } },
              { collectionId: { eq: collectionId } },
            ],
          },
        });

      if (listErrors && listErrors.length > 0) {
        throw new Error(listErrors.map((e) => e.message).join(", "));
      }

      if (!relations || relations.length === 0) {
        return;
      }

      const deletions = await Promise.all(
        relations.map((relation) =>
          client.models.BookmarkCollection.delete({ id: relation.id }),
        ),
      );
      const deletionErrors = deletions.flatMap((r) => r.errors ?? []);
      if (deletionErrors.length > 0) {
        throw new Error(deletionErrors.map((e) => e.message).join(", "));
      }
    },
    [client],
  );

  /**
   * 既に `bookmarkId` と `collectionId` の BookmarkCollection が存在するかを判定する。
   *
   * - クライアント未設定時は false を返す（安全側）。
   * - 1 件でも該当レコードがあれば true を返す。
   *
   * Validates: Requirements 2.5
   */
  const checkBookmarkInCollection = useCallback(
    async (bookmarkId: string, collectionId: string): Promise<boolean> => {
      if (!client) {
        return false;
      }

      const { data, errors } = await client.models.BookmarkCollection.list({
        filter: {
          and: [
            { bookmarkId: { eq: bookmarkId } },
            { collectionId: { eq: collectionId } },
          ],
        },
        limit: 1,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }

      return Boolean(data && data.length > 0);
    },
    [client],
  );

  return {
    collections,
    collectionTree,
    bookmarkCollections,
    createCollection,
    updateCollection,
    moveCollection,
    deleteCollection,
    addBookmarkToCollection,
    removeBookmarkFromCollection,
    checkBookmarkInCollection,
  };
}
