"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";
import { validateUrl } from "@/src/lib/validators";
import { calculateNewSortOrders } from "@/src/lib/sortOrderUtils";
import type { Bookmark, BookmarkInput, BookmarkStatus } from "@/src/types";

/**
 * useBookmarks フックの戻り値。
 *
 * Bookmark の CRUD、ページネーション（20 件ずつ / nextToken）、
 * 重複チェックを提供する。Amplify 未設定時はすべてのメソッドが
 * エラーを投げる no-op 状態となり、UI は空データで描画可能。
 *
 * Validates: Requirements 1.1, 1.5, 2.1, 2.3, 3.1, 3.3
 */
export interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchAllBookmarkUrls: () => Promise<Array<{ id: string; url: string; ogpImageUrl: string }>>;
  createBookmark: (input: BookmarkInput) => Promise<Bookmark>;
  updateBookmark: (
    id: string,
    input: Partial<BookmarkInput>,
  ) => Promise<Bookmark>;
  deleteBookmark: (id: string) => Promise<void>;
  checkDuplicate: (url: string) => Promise<Bookmark | null>;
  updateBookmarkStatus: (id: string, status: BookmarkStatus) => Promise<void>;
  toggleReadable: (id: string) => Promise<void>;
  reorderBookmarks: (bookmarkId: string, newIndex: number) => Promise<void>;
}

/** 1 ページあたりの取得件数（Requirements 2.1, 2.3）。 */
const PAGE_SIZE = 20;

/** Amplify 未設定時に投げるエラーメッセージ。 */
const NOT_CONFIGURED_MESSAGE = "Amplify is not configured";

/**
 * Amplify Data の Bookmark レコード型（自動生成）。
 *
 * スキーマ上 required でないフィールドは null になり得るため、
 * アプリ側の {@link Bookmark} 型へマッピングする際に空文字列へ正規化する。
 */
type BookmarkRecord = Schema["Bookmark"]["type"];

/** Amplify レコードをアプリ内部の Bookmark 型へ正規化する。 */
function mapRecordToBookmark(record: BookmarkRecord): Bookmark {
  return {
    id: record.id,
    url: record.url,
    title: record.title ?? "",
    description: record.description ?? "",
    memo: record.memo ?? "",
    ogpImageUrl: record.ogpImageUrl ?? "",
    status: (record.status as Bookmark["status"]) ?? "inbox",
    accessCount: record.accessCount ?? 0,
    lastAccessedAt: record.lastAccessedAt ?? "",
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? "",
    owner: record.owner ?? "",
    // 後方互換: 既存レコードでは新フィールドが null/undefined の場合がある
    isReadable: record.isReadable ?? false,
    sortOrder: record.sortOrder ?? 0,
    pinned: record.pinned ?? false,
    collectionId: (record as Record<string, unknown>).collectionId as string | null ?? null,
  };
}

/**
 * Bookmark 配列を createdAt の降順で安定ソートする。
 *
 * Amplify Data（DynamoDB）の list はデフォルトでは createdAt の順序を
 * 保証しないため、取得結果をクライアントサイドでソートする。
 * Validates: Requirements 2.1
 */
function sortByCreatedAtDesc(items: Bookmark[]): Bookmark[] {
  return [...items].sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/** Amplify Data のエラー配列を単一メッセージへ整形する。 */
function formatErrors(errors: ReadonlyArray<{ message: string }>): string {
  return errors.map((e) => e.message).join("; ");
}

/**
 * Bookmark 一覧の取得・作成・更新・削除・重複チェックを扱うカスタムフック。
 *
 * - 初期マウント時に最新 20 件を取得（createdAt 降順）
 * - `loadMore` で次ページ（nextToken）を取得し、配列末尾に追記
 * - `createBookmark` は URL バリデーション後に作成し、結果を先頭へ追加
 * - `updateBookmark` は対象 Bookmark を更新して状態を差し替え
 * - `deleteBookmark` は対象 Bookmark を削除して状態から除外
 * - `checkDuplicate` は URL 完全一致で既存 Bookmark を検索
 *
 * Amplify 未設定時はデータ無し・エラー無しの安全な idle 状態を返し、
 * すべての変更系メソッドはエラーを投げる。
 *
 * Validates: Requirements 1.1, 1.5, 2.1, 2.3, 3.1, 3.3
 */
export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const nextTokenRef = useRef<string | null>(null);

  // Amplify クライアントは設定済みの場合のみ初期化する。
  // 未設定時は null を保持し、各メソッドでガードする。
  const [client] = useState(() =>
    isAmplifyConfigured() ? generateClient<Schema>() : null,
  );

  // 初期読み込みと次ページ読み込みの共通処理。
  const fetchPage = useCallback(
    async (mode: "initial" | "loadMore") => {
      if (!client) return;

      setIsLoading(true);
      setError(null);
      try {
        // 初期ロードは全件取得（nextToken を辿って全ページ取得）
        if (mode === "initial") {
          const all: Bookmark[] = [];
          let nextPageToken: string | null = null;
          while (true) {
            const listResult = await client.models.Bookmark.list(
              nextPageToken ? { limit: 100, nextToken: nextPageToken } : { limit: 100 },
            ) as { data: BookmarkRecord[]; errors?: { message: string }[]; nextToken?: string | null };
            if (listResult.errors && listResult.errors.length > 0) {
              setError(formatErrors(listResult.errors));
              return;
            }
            for (const record of listResult.data ?? []) {
              if (record == null) continue;
              all.push(mapRecordToBookmark(record));
            }
            if (!listResult.nextToken) break;
            nextPageToken = listResult.nextToken;
          }

          nextTokenRef.current = null;
          setHasMore(false);
          setBookmarks(sortByCreatedAtDesc(all));
        } else {
          // loadMore は後方互換のため残すが、初期ロードで全件取得するため通常は呼ばれない
          const response = await client.models.Bookmark.list({
            limit: PAGE_SIZE,
            nextToken: nextTokenRef.current,
          });
          if (response.errors && response.errors.length > 0) {
            setError(formatErrors(response.errors));
            return;
          }
          const mapped = (response.data ?? []).map(mapRecordToBookmark);
          nextTokenRef.current = response.nextToken ?? null;
          setHasMore(Boolean(response.nextToken));
          setBookmarks((prev) => sortByCreatedAtDesc([...prev, ...mapped]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  // 初期ロード（Amplify 設定済みの場合のみ）。
  useEffect(() => {
    if (!client) return;
    void fetchPage("initial");
  }, [client, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!client) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    if (!nextTokenRef.current) return;
    await fetchPage("loadMore");
  }, [client, fetchPage]);

  const refresh = useCallback(async () => {
    if (!client) return;
    nextTokenRef.current = null;
    await fetchPage("initial");
  }, [client, fetchPage]);

  /**
   * 全ブックマークの ID と URL を取得する（OGP バッチ取得用）。
   * 表示用の state は更新せず、結果を直接返す。
   */
  const fetchAllBookmarkUrls = useCallback(
    async (): Promise<Array<{ id: string; url: string; ogpImageUrl: string }>> => {
      if (!client) return [];
      const results: Array<{ id: string; url: string; ogpImageUrl: string }> = [];
      let token: string | null = null;

      do {
        const response = await client.models.Bookmark.list({
          limit: 100,
          nextToken: token,
        }) as { data: Array<{ id: string; url: string; ogpImageUrl?: string | null }>; errors?: Array<unknown>; nextToken?: string | null };
        if (response.errors && response.errors.length > 0) break;
        for (const record of response.data ?? []) {
          results.push({
            id: record.id,
            url: record.url,
            ogpImageUrl: record.ogpImageUrl ?? "",
          });
        }
        token = response.nextToken ?? null;
      } while (token);

      return results;
    },
    [client],
  );

  const createBookmark = useCallback(
    async (input: BookmarkInput): Promise<Bookmark> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const urlCheck = validateUrl(input.url);
      if (!urlCheck.valid) {
        throw new Error(urlCheck.error ?? "Invalid URL");
      }

      const now = new Date().toISOString();
      const response = await client.models.Bookmark.create({
        url: input.url,
        title: input.title ?? "",
        description: input.description ?? "",
        memo: input.memo ?? "",
        ogpImageUrl: input.ogpImageUrl ?? "",
        createdAt: now,
        updatedAt: now,
      });

      if (response.errors && response.errors.length > 0) {
        throw new Error(formatErrors(response.errors));
      }
      if (!response.data) {
        throw new Error("Bookmark の作成に失敗しました");
      }

      const created = mapRecordToBookmark(response.data);
      setBookmarks((prev) => [created, ...prev]);
      return created;
    },
    [client],
  );

  const updateBookmark = useCallback(
    async (
      id: string,
      input: Partial<BookmarkInput>,
    ): Promise<Bookmark> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      // URL が含まれる場合のみバリデーション。他フィールドは API 側の制約に委ねる。
      if (input.url !== undefined) {
        const urlCheck = validateUrl(input.url);
        if (!urlCheck.valid) {
          throw new Error(urlCheck.error ?? "Invalid URL");
        }
      }

      const response = await client.models.Bookmark.update({
        id,
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.memo !== undefined ? { memo: input.memo } : {}),
        ...(input.ogpImageUrl !== undefined
          ? { ogpImageUrl: input.ogpImageUrl }
          : {}),
        ...(input.isReadable !== undefined
          ? { isReadable: input.isReadable }
          : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        ...("collectionId" in input
          ? { collectionId: input.collectionId ?? null }
          : {}),
        updatedAt: new Date().toISOString(),
      });

      if (response.errors && response.errors.length > 0) {
        throw new Error(formatErrors(response.errors));
      }
      if (!response.data) {
        throw new Error("Bookmark の更新に失敗しました");
      }

      const updated = mapRecordToBookmark(response.data);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b)),
      );
      return updated;
    },
    [client],
  );

  const deleteBookmark = useCallback(
    async (id: string): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      // 関連する BookmarkTag レコードを削除
      let btToken: string | undefined = undefined;
      while (true) {
        const btRes = await client.models.BookmarkTag.list({
          filter: { bookmarkId: { eq: id } },
          limit: 1000,
          nextToken: btToken,
        }) as { data: Array<{ id: string }>; nextToken?: string | null };
        await Promise.all(
          btRes.data.map((row) => client.models.BookmarkTag.delete({ id: row.id })),
        );
        if (!btRes.nextToken) break;
        btToken = btRes.nextToken;
      }

      // 関連する BookmarkCollection レコードを削除
      let bcToken: string | undefined = undefined;
      while (true) {
        const bcRes = await client.models.BookmarkCollection.list({
          filter: { bookmarkId: { eq: id } },
          limit: 1000,
          nextToken: bcToken,
        }) as { data: Array<{ id: string }>; nextToken?: string | null };
        await Promise.all(
          bcRes.data.map((row) => client.models.BookmarkCollection.delete({ id: row.id })),
        );
        if (!bcRes.nextToken) break;
        bcToken = bcRes.nextToken;
      }

      // Bookmark 本体を削除
      const response = await client.models.Bookmark.delete({ id });
      if (response.errors && response.errors.length > 0) {
        throw new Error(formatErrors(response.errors));
      }

      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    },
    [client],
  );

  const checkDuplicate = useCallback(
    async (url: string): Promise<Bookmark | null> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const response = await client.models.Bookmark.list({
        filter: { url: { eq: url } },
        limit: 1,
      });

      if (response.errors && response.errors.length > 0) {
        throw new Error(formatErrors(response.errors));
      }

      const first = response.data?.[0];
      return first ? mapRecordToBookmark(first) : null;
    },
    [client],
  );

  const updateBookmarkStatus = useCallback(
    async (id: string, status: BookmarkStatus): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      // 楽観的 UI 更新: 即座にローカル状態を更新する
      const previousBookmarks = bookmarks;
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b)),
      );

      try {
        const response = await client.models.Bookmark.update({
          id,
          status,
          updatedAt: new Date().toISOString(),
        });

        if (response.errors && response.errors.length > 0) {
          // API 失敗時: ロールバック
          setBookmarks(previousBookmarks);
          console.error(
            "ステータスの更新に失敗しました:",
            formatErrors(response.errors),
          );
        }
      } catch (err) {
        // API 失敗時: ロールバック
        setBookmarks(previousBookmarks);
        console.error(
          "ステータスの更新に失敗しました:",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [client, bookmarks],
  );

  /**
   * isReadable フィールドをトグルする。
   * 楽観的 UI 更新を行い、Amplify Data に永続化する。
   *
   * Validates: Requirements 1.2, 1.5
   */
  const toggleReadable = useCallback(
    async (id: string): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const target = bookmarks.find((b) => b.id === id);
      if (!target) return;

      const newValue = !target.isReadable;

      // 楽観的 UI 更新
      const previousBookmarks = bookmarks;
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isReadable: newValue } : b)),
      );

      try {
        const response = await client.models.Bookmark.update({
          id,
          isReadable: newValue,
          updatedAt: new Date().toISOString(),
        });

        if (response.errors && response.errors.length > 0) {
          setBookmarks(previousBookmarks);
          console.error(
            "isReadable の更新に失敗しました:",
            formatErrors(response.errors),
          );
        }
      } catch (err) {
        setBookmarks(previousBookmarks);
        console.error(
          "isReadable の更新に失敗しました:",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [client, bookmarks],
  );

  /**
   * ブックマークの並び順を変更する。
   * sortOrder を再計算し、楽観的 UI 更新後に Amplify Data へ永続化する。
   *
   * Validates: Requirements 3.3, 3.4
   */
  const reorderBookmarks = useCallback(
    async (bookmarkId: string, newIndex: number): Promise<void> => {
      if (!client) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      // sortOrder 昇順でソートした配列を基準にする
      const sorted = [...bookmarks].sort((a, b) => a.sortOrder - b.sortOrder);
      const fromIndex = sorted.findIndex((b) => b.id === bookmarkId);
      if (fromIndex === -1) return;

      const updates = calculateNewSortOrders(sorted, fromIndex, newIndex);
      if (updates.length === 0) return;

      // 楽観的 UI 更新
      const previousBookmarks = bookmarks;
      setBookmarks((prev) => {
        const updatedMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
        return prev.map((b) =>
          updatedMap.has(b.id)
            ? { ...b, sortOrder: updatedMap.get(b.id)! }
            : b,
        );
      });

      // 全変更を並列で永続化
      try {
        const results = await Promise.all(
          updates.map((u) =>
            client.models.Bookmark.update({
              id: u.id,
              sortOrder: u.sortOrder,
              updatedAt: new Date().toISOString(),
            }),
          ),
        );

        const hasError = results.some(
          (r) => r.errors && r.errors.length > 0,
        );
        if (hasError) {
          setBookmarks(previousBookmarks);
          console.error("sortOrder の更新に失敗しました");
        }
      } catch (err) {
        setBookmarks(previousBookmarks);
        console.error(
          "sortOrder の更新に失敗しました:",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [client, bookmarks],
  );

  return {
    bookmarks,
    isLoading,
    hasMore,
    error,
    loadMore,
    refresh,
    fetchAllBookmarkUrls,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    checkDuplicate,
    updateBookmarkStatus,
    toggleReadable,
    reorderBookmarks,
  };
}
