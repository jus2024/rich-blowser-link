"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";

import type { Schema } from "@/amplify/data/resource";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";
import {
  truncateFolderPath,
  filterValidBookmarks,
  parseNetscapeBookmarkFile,
} from "@/src/lib/import/bookmarkParser";
import { checkDuplicateUrls } from "@/src/lib/import/duplicateChecker";
import { processBatches } from "@/src/lib/import/batchProcessor";
import type {
  DuplicateCheckResult,
  DuplicateStrategy,
  ImportProgress,
  ImportResult,
  ParseResult,
  ParsedBookmark,
} from "@/src/lib/import/types";
import type { Bookmark } from "@/src/types";
import type { ImportCollectionMode } from "@/src/lib/ai/types";

/**
 * 10MB のインポート上限（Requirement 10.1）。
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * 進捗初期値。status は `idle`、各カウントは 0。
 */
const INITIAL_PROGRESS: ImportProgress = {
  status: "idle",
  processedCount: 0,
  totalCount: 0,
  percentage: 0,
  estimatedRemainingSeconds: null,
  currentBatch: 0,
  totalBatches: 0,
};

/**
 * `useImport` フックの戻り値（design.md の「インポート用カスタムフックのインターフェース」参照）。
 */
export interface UseImportReturn {
  /** ファイルをパースしてプレビュー可能な ParseResult を返す。Amplify は不要。 */
  parseFile: (file: File) => Promise<ParseResult>;
  /** 重複チェックを実行（Amplify Data から既存 Bookmark を取得して突き合わせ） */
  checkDuplicates: (
    bookmarks: ParsedBookmark[],
  ) => Promise<DuplicateCheckResult>;
  /** インポートを実行（Collection 作成 → Bookmark 作成/マージ → 紐付け） */
  startImport: (
    parseResult: ParseResult,
    duplicateStrategy: DuplicateStrategy,
    collectionMode?: ImportCollectionMode,
  ) => Promise<ImportResult>;
  /** 進行中のインポートをキャンセル */
  cancelImport: () => void;
  /** 現在の進捗 */
  progress: ImportProgress;
  /** 直近のエラーメッセージ。成功時は null */
  error: string | null;
}

type AmplifyBookmark = Schema["Bookmark"]["type"];
type AmplifyCollection = Schema["Collection"]["type"];

/**
 * Chrome ブックマークインポート用のカスタムフック。
 *
 * 振る舞いの概要:
 * - `parseFile` は純粋ロジック（DOMParser + フィルタ）のみで、Amplify が未設定でも動作する
 * - `checkDuplicates` と `startImport` は Amplify Data クライアントを使用する
 * - インポートは AbortController で中断可能（`cancelImport`）
 * - 進捗は `progress` として公開され、バッチ完了ごとに更新される
 *
 * Validates: Requirements 10.1, 10.5, 10.6, 10.7, 10.11, 10.12
 */
export function useImport(): UseImportReturn {
  const [progress, setProgress] = useState<ImportProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);

  // Amplify Data クライアントはマウント中 1 度だけ生成する。
  // 未設定環境では null のまま保持し、バックエンド操作時に明示エラーを返す。
  const [client] = useState<ReturnType<typeof generateClient<Schema>> | null>(
    () => (isAmplifyConfigured() ? generateClient<Schema>() : null),
  );

  // 進行中インポートのキャンセル用 AbortController。
  const abortControllerRef = useRef<AbortController | null>(null);

  // アンマウント時に進行中リクエストを中断してメモリリークを防ぐ。
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const parseFile = useCallback(async (file: File): Promise<ParseResult> => {
    setError(null);
    setProgress({
      ...INITIAL_PROGRESS,
      status: "parsing",
    });

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const message = `ファイルサイズが上限 (${Math.round(
        MAX_FILE_SIZE_BYTES / (1024 * 1024),
      )}MB) を超えています。`;
      setError(message);
      setProgress({ ...INITIAL_PROGRESS, status: "error" });
      throw new Error(message);
    }

    let html: string;
    try {
      html = await file.text();
    } catch (e) {
      const message =
        e instanceof Error
          ? `ファイルの読み込みに失敗しました: ${e.message}`
          : "ファイルの読み込みに失敗しました。";
      setError(message);
      setProgress({ ...INITIAL_PROGRESS, status: "error" });
      throw new Error(message);
    }

    let rawParseResult: ParseResult;
    try {
      rawParseResult = parseNetscapeBookmarkFile(html);
    } catch (e) {
      const message =
        e instanceof Error
          ? `ブックマークファイルの解析に失敗しました: ${e.message}`
          : "ブックマークファイルの解析に失敗しました。";
      setError(message);
      setProgress({ ...INITIAL_PROGRESS, status: "error" });
      throw new Error(message);
    }

    const { valid, skipped } = filterValidBookmarks(rawParseResult.bookmarks);

    const result: ParseResult = {
      bookmarks: valid,
      folders: rawParseResult.folders,
      totalCount: valid.length + skipped.length,
      validCount: valid.length,
      skippedCount: skipped.length,
    };

    setProgress({
      ...INITIAL_PROGRESS,
      status: "idle",
      totalCount: result.validCount,
    });

    return result;
  }, []);

  const requireClient = useCallback((): NonNullable<typeof client> => {
    if (!client) {
      const message = "Amplify is not configured";
      setError(message);
      throw new Error(message);
    }
    return client;
  }, [client]);

  const checkDuplicates = useCallback(
    async (bookmarks: ParsedBookmark[]): Promise<DuplicateCheckResult> => {
      const activeClient = requireClient();
      setError(null);
      setProgress((prev) => ({
        ...prev,
        status: "checking_duplicates",
      }));

      try {
        const existing = await fetchAllBookmarks(activeClient);
        const existingAsBookmarks = existing.map(toBookmark);
        return checkDuplicateUrls(bookmarks, existingAsBookmarks);
      } catch (e) {
        const message =
          e instanceof Error
            ? `重複チェックに失敗しました: ${e.message}`
            : "重複チェックに失敗しました。";
        setError(message);
        setProgress((prev) => ({ ...prev, status: "error" }));
        throw new Error(message);
      }
    },
    [requireClient],
  );

  const startImport = useCallback(
    async (
      parseResult: ParseResult,
      duplicateStrategy: DuplicateStrategy,
      collectionMode: ImportCollectionMode = "folder-inherit",
    ): Promise<ImportResult> => {
      const activeClient = requireClient();
      setError(null);

      // 直前の中断指示をクリアし、新しい AbortController を割り当てる。
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const totalCount = parseResult.bookmarks.length;

      setProgress({
        status: "importing",
        processedCount: 0,
        totalCount,
        percentage: 0,
        estimatedRemainingSeconds: null,
        currentBatch: 0,
        totalBatches: 0,
      });

      try {
        // 既存データの取得は 1 度だけ行う（Bookmark は重複検出と merge の両方で使う）。
        const [existingBookmarkRecords, existingCollectionRecords] =
          await Promise.all([
            fetchAllBookmarks(activeClient),
            fetchAllCollections(activeClient),
          ]);

        const existingBookmarks = existingBookmarkRecords.map(toBookmark);
        const duplicateResult = checkDuplicateUrls(
          parseResult.bookmarks,
          existingBookmarks,
        );
        const duplicateUrlSet = new Set(duplicateResult.duplicateUrls);

        // url → 既存 Bookmark レコードのルックアップ（merge 時に id / 更新対象を引くために使う）
        const existingByUrl = new Map<string, AmplifyBookmark>();
        for (const record of existingBookmarkRecords) {
          existingByUrl.set(record.url, record);
        }

        // 必要な Collection を階層順（親→子→孫）に作成する。
        // キー: "parentId:name"（同名でも別階層なら別 Collection）
        // 値: Collection ID
        const collectionByKey = new Map<string, string>();

        // 既存 Collection をキーマップに登録
        for (const record of existingCollectionRecords) {
          const parentId = (record as Record<string, unknown>).parentId as string | null ?? null;
          const key = `${parentId ?? "root"}:${record.name}`;
          collectionByKey.set(key, record.id);
        }

        let createdCollections = 0;

        // flat モード時は Collection 作成をスキップ
        if (collectionMode !== "flat") {
          // 必要なパス（最大3段に切り詰め）を収集し、親から順に作成
          const neededPaths = new Set<string>();
          for (const bookmark of parseResult.bookmarks) {
            if (bookmark.folderPath.length === 0) continue;
            const truncated = truncateFolderPath(bookmark.folderPath, 3);
            // 各段のパスを登録（親パスも必要）
            for (let i = 1; i <= truncated.length; i++) {
              neededPaths.add(JSON.stringify(truncated.slice(0, i)));
            }
          }

          // パスを深さ順にソートして親から作成
          const sortedPaths = Array.from(neededPaths)
            .map((s) => JSON.parse(s) as string[])
            .sort((a, b) => a.length - b.length);

          for (const path of sortedPaths) {
            if (controller.signal.aborted) break;

            const name = path[path.length - 1];
            const parentPath = path.slice(0, -1);

            // 親 ID をパスを辿って解決する
            let resolvedParentId: string | null = null;
            if (parentPath.length > 0) {
              let currentId: string | null = null;
              for (let i = 0; i < parentPath.length; i++) {
                const seg: string = parentPath[i];
                const segKey: string = `${currentId ?? "root"}:${seg}`;
                currentId = collectionByKey.get(segKey) ?? null;
              }
              resolvedParentId = currentId;
            }

            const key = `${resolvedParentId ?? "root"}:${name}`;
            if (collectionByKey.has(key)) continue;

            const createPayload: Record<string, unknown> = { name, description: "" };
            if (resolvedParentId !== null) createPayload.parentId = resolvedParentId;

            const { data, errors } = await activeClient.models.Collection.create(
              createPayload as Parameters<typeof activeClient.models.Collection.create>[0],
            );
            if (errors && errors.length > 0) continue;
            if (data) {
              collectionByKey.set(key, data.id);
              createdCollections += 1;
            }
          }
        }

        const skipUrls =
          duplicateStrategy === "skip" ? duplicateUrlSet : undefined;

        const batchResult = await processBatches<ParsedBookmark, string>(
          {
            items: parseResult.bookmarks,
            skipUrls,
            signal: controller.signal,
            onProgress: (p) => setProgress(p),
            createItem: async (bookmark) => {
              const bookmarkId = await upsertBookmark(
                activeClient,
                bookmark,
                duplicateStrategy,
                duplicateUrlSet,
                existingByUrl,
              );
              // flat モード時は collectionId の割り当てをスキップ
              if (collectionMode !== "flat") {
                await assignBookmarkToCollection(
                  activeClient,
                  bookmarkId,
                  bookmark,
                  collectionByKey,
                );
              }
              return bookmarkId;
            },
          },
          { createdCollections },
        );

        setProgress((prev) => ({
          ...prev,
          status: "completed",
          processedCount: batchResult.successCount + batchResult.failedCount + batchResult.skippedCount,
          totalCount,
          percentage: totalCount === 0 ? 100 : prev.percentage,
          estimatedRemainingSeconds: 0,
        }));

        return batchResult;
      } catch (e) {
        const message =
          e instanceof Error
            ? `インポート中にエラーが発生しました: ${e.message}`
            : "インポート中にエラーが発生しました。";
        setError(message);
        setProgress((prev) => ({ ...prev, status: "error" }));
        throw new Error(message);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [requireClient],
  );

  const cancelImport = useCallback(() => {
    const controller = abortControllerRef.current;
    if (!controller) {
      return;
    }
    controller.abort();
    abortControllerRef.current = null;
    setProgress((prev) => ({
      ...prev,
      status: "completed",
    }));
  }, []);

  return {
    parseFile,
    checkDuplicates,
    startImport,
    cancelImport,
    progress,
    error,
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * Amplify の Bookmark レコードを、アプリ側の `Bookmark` 型（必須フィールド版）に変換する。
 *
 * `checkDuplicateUrls` は `url` フィールドしか参照しないが、
 * 型整合のため欠損可能な値は空文字列で埋める。
 */
function toBookmark(record: AmplifyBookmark): Bookmark {
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
    isReadable: (record as Record<string, unknown>).isReadable === true ? true : false,
    sortOrder: typeof (record as Record<string, unknown>).sortOrder === "number" ? (record as Record<string, unknown>).sortOrder as number : 0,
    pinned: (record as Record<string, unknown>).pinned === true ? true : false,
    collectionId: (record as Record<string, unknown>).collectionId as string | null ?? null,
  };
}

/**
 * すべての Bookmark を取得する（`nextToken` を辿って完全に列挙）。
 */
async function fetchAllBookmarks(
  client: ReturnType<typeof generateClient<Schema>>,
): Promise<AmplifyBookmark[]> {
  const all: AmplifyBookmark[] = [];
  let nextToken: string | undefined;
  do {
    const response = await client.models.Bookmark.list(
      nextToken !== undefined ? { nextToken } : {},
    );
    if (response.data) {
      all.push(...response.data);
    }
    nextToken = response.nextToken ?? undefined;
  } while (nextToken);
  return all;
}

/**
 * すべての Collection を取得する（`nextToken` を辿って完全に列挙）。
 */
async function fetchAllCollections(
  client: ReturnType<typeof generateClient<Schema>>,
): Promise<AmplifyCollection[]> {
  const all: AmplifyCollection[] = [];
  let nextToken: string | undefined;
  do {
    const response = await client.models.Collection.list(
      nextToken !== undefined ? { nextToken } : {},
    );
    if (response.data) {
      all.push(...response.data);
    }
    nextToken = response.nextToken ?? undefined;
  } while (nextToken);
  return all;
}

/**
 * 1 件分の Bookmark を作成、または `merge` 戦略に従ってタイトルを更新する。
 *
 * 戻り値は対象 Bookmark の ID（作成後 / 既存）。
 */
async function upsertBookmark(
  client: ReturnType<typeof generateClient<Schema>>,
  bookmark: ParsedBookmark,
  strategy: DuplicateStrategy,
  duplicateUrlSet: Set<string>,
  existingByUrl: Map<string, AmplifyBookmark>,
): Promise<string> {
  if (strategy === "merge" && duplicateUrlSet.has(bookmark.url)) {
    const existing = existingByUrl.get(bookmark.url);
    if (existing) {
      const { data, errors } = await client.models.Bookmark.update({
        id: existing.id,
        title: bookmark.title,
      });
      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "Bookmark update failed");
      }
      return data?.id ?? existing.id;
    }
    // 既存マップに無い場合は URL で再検索してフォールバックする。
    const { data: listed } = await client.models.Bookmark.list({
      filter: { url: { eq: bookmark.url } },
    });
    const fallback = listed?.[0];
    if (fallback) {
      const { data, errors } = await client.models.Bookmark.update({
        id: fallback.id,
        title: bookmark.title,
      });
      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "Bookmark update failed");
      }
      return data?.id ?? fallback.id;
    }
    // ここまで来た場合は重複判定と整合しないが、安全策として新規作成に倒す。
  }

  const { data, errors } = await client.models.Bookmark.create({
    url: bookmark.url,
    title: bookmark.title,
  });
  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Bookmark create failed");
  }
  if (!data) {
    throw new Error("Bookmark create returned no data");
  }
  return data.id;
}

/**
 * Bookmark の collectionId フィールドを対応する Collection に設定する（1対1版）。
 * フォルダパスを最大3段に切り詰め、対応する Collection ID を解決して更新する。
 */
async function assignBookmarkToCollection(
  client: ReturnType<typeof generateClient<Schema>>,
  bookmarkId: string,
  bookmark: ParsedBookmark,
  collectionByKey: Map<string, string>,
): Promise<void> {
  if (bookmark.folderPath.length === 0) return;
  const truncated = truncateFolderPath(bookmark.folderPath, 3);

  // パスを辿って最終段の Collection ID を解決
  let currentParentId: string | null = null;
  let collectionId: string | null = null;
  for (const segment of truncated) {
    const key = `${currentParentId ?? "root"}:${segment}`;
    const id = collectionByKey.get(key);
    if (!id) return; // 解決できなければスキップ
    collectionId = id;
    currentParentId = id;
  }

  if (!collectionId) return;

  await client.models.Bookmark.update({
    id: bookmarkId,
    collectionId,
  } as Parameters<typeof client.models.Bookmark.update>[0]);
}
