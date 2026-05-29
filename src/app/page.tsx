"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBookmarks } from "@/src/hooks/useBookmarks";
import { useCollections } from "@/src/hooks/useCollections";
import { useSearch } from "@/src/hooks/useSearch";
import { useTags } from "@/src/hooks/useTags";
import { useDisplayMode } from "@/src/hooks/useDisplayMode";
import { useSort } from "@/src/hooks/useSort";
import { useAccessTracker } from "@/src/hooks/useAccessTracker";
import { usePinning } from "@/src/hooks/usePinning";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { useAIEnrichment } from "@/src/hooks/useAIEnrichment";

import { filterBookmarksByCollectionId } from "@/src/lib/collectionUtils";
import { filterBookmarksByTags } from "@/src/lib/tagUtils";
import { EnrichmentQueue } from "@/src/lib/ai/enrichmentQueue";
import type { EnrichmentQueueProgress, EnrichmentItemResult } from "@/src/lib/ai/enrichmentQueue";
import { OGPFetchQueue } from "@/src/lib/pipeline/ogpFetchQueue";
import type { OGPFetchResult } from "@/src/lib/pipeline/ogpFetchQueue";
import type { ImportCollectionMode } from "@/src/lib/ai/types";
import type { BookmarkWithTags } from "@/src/lib/search";
import type {
  Bookmark,
  BookmarkCollection,
  BookmarkInput,
  BookmarkStatus,
  Collection,
  CollectionInput,
} from "@/src/types";

import AgentChatSection from "@/src/components/agent/AgentChatSection";
import { BookmarkDeleteDialog } from "@/src/components/bookmark/BookmarkDeleteDialog";
import { BookmarkFormDialog } from "@/src/components/bookmark/BookmarkFormDialog";
import { BookmarkList } from "@/src/components/bookmark/BookmarkList";
import { BookmarkGrid } from "@/src/components/bookmark/BookmarkGrid";
import { BookmarkCompactList } from "@/src/components/bookmark/BookmarkCompactList";
import { BookmarkToolbar } from "@/src/components/bookmark/BookmarkToolbar";
import { DuplicateDialog } from "@/src/components/bookmark/DuplicateDialog";
import { CollectionList } from "@/src/components/collection/CollectionList";
import { CollectionForm } from "@/src/components/collection/CollectionForm";
import { CollectionDeleteDialog } from "@/src/components/collection/CollectionDeleteDialog";
import { CollectionAssignDialog } from "@/src/components/collection/CollectionAssignDialog";
import { DndProvider } from "@/src/components/dnd/DndProvider";
import { useDragAndDrop } from "@/src/hooks/useDragAndDrop";
import { ImportDialog } from "@/src/components/import/ImportDialog";
import { PipelineProgress } from "@/src/components/ai/PipelineProgress";
import type { OGPFetchQueueProgress } from "@/src/components/ai/PipelineProgress";
import { SearchBar } from "@/src/components/search/SearchBar";
import { StatusFilter } from "@/src/components/filter/StatusFilter";
import { TagFilter } from "@/src/components/tag/TagFilter";
import { QuickAdd } from "@/src/components/bookmark/QuickAdd";
import { ResizableSidebar } from "@/src/components/layout/ResizableSidebar";
import { MobileSidebarOverlay } from "@/src/components/layout/MobileSidebarOverlay";
import { MobileChatOverlay } from "@/src/components/layout/MobileChatOverlay";

import styles from "./page.module.css";

/** AgentCore Runtime ARN（環境変数から取得）。 */
const RUNTIME_ARN = process.env.NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN;

/**
 * トップページ（メインレイアウト）
 *
 * レイアウト構成:
 * - サイドバー: StatusFilter + CollectionList + CollectionForm + TagFilter
 * - メインコンテンツ: SearchBar + BookmarkToolbar + BookmarkForm + 表示モード別一覧
 * - チャットセクション: AgentChatSection
 *
 * Validates: Requirements 2.1, 5.1, 5.3, 6.1, 7.1, 8.2, 9.1, 11.2, 11.3, 13.5
 */
export default function Home() {
  // --- Hooks ---
  const {
    bookmarks,
    isLoading: isBookmarksLoading,
    hasMore,
    loadMore,
    refresh: refreshBookmarks,
    fetchAllBookmarkUrls,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    checkDuplicate,
    updateBookmarkStatus,
    toggleReadable,
    reorderBookmarks,
  } = useBookmarks();

  const { togglePin } = usePinning({ bookmarks, updateBookmark });

  const { tags, bookmarkTags, addTagToBookmark, removeTagFromBookmark, createTag, deleteTag, deleteUnusedTags, refresh: refreshTags } = useTags();
  const {
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
  } = useCollections();

  const { displayMode, setDisplayMode } = useDisplayMode();
  const { isAIEnabled, setAIEnabled } = useAIEnrichment();
  const { sortKey, setSortKey, sortBookmarks } = useSort();
  const { trackAccess } = useAccessTracker();

  // --- Drag & Drop ---
  const {
    activeId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    duplicateNotification,
    dismissNotification,
  } = useDragAndDrop({
    bookmarks,
    collections,
    displayMode,
    addBookmarkToCollection,
    checkBookmarkInCollection,
    onReorder: reorderBookmarks,
  });

  const activeBookmark = useMemo(
    () => (activeId ? bookmarks.find((b) => b.id === activeId) ?? null : null),
    [activeId, bookmarks],
  );

  // --- State: Collection 選択 ---
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null | undefined
  >(undefined);

  // --- State: Tag フィルタ ---
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // --- State: ステータスフィルタ ---
  const [selectedStatus, setSelectedStatus] = useState<BookmarkStatus | null>(null);

  // --- State: BookmarkCollection（useCollections から取得）---
  // bookmarkCollections は useCollections が購読・管理するため、ローカル state 不要

  // --- State: 振り分けダイアログ ---
  const [assigningBookmark, setAssigningBookmark] = useState<Bookmark | null>(null);

  // --- State: サイドバー・チャットパネルの開閉 ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  // --- モバイル対応 ---
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // 右サイドバー: モバイル時は強制的に非表示、デスクトップ復帰時に前回値を復元
  const previousChatCollapsed = useRef(isChatCollapsed);
  useEffect(() => {
    if (isMobile) {
      previousChatCollapsed.current = isChatCollapsed;
      setIsChatCollapsed(true);
    } else {
      setIsChatCollapsed(previousChatCollapsed.current);
    }
  }, [isMobile]);

  // 左サイドバー: モバイル時はオーバーレイ経由
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(true);
    }
  }, [isMobile]);

  // オーバーレイ開閉と isSidebarCollapsed の同期（モバイル時のみ）
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(!isMobileMenuOpen);
    }
  }, [isMobile, isMobileMenuOpen]);

  // 表示モード: モバイル時は "list" 固定
  const effectiveDisplayMode = isMobile ? "list" : displayMode;

  // --- State: フォーム表示 ---
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  // --- State: 削除ダイアログ ---
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(
    null,
  );

  // --- State: 重複ダイアログ ---
  const [duplicateBookmark, setDuplicateBookmark] = useState<Bookmark | null>(
    null,
  );
  const [pendingInput, setPendingInput] = useState<{
    data: BookmarkInput;
    tags: string[];
  } | null>(null);

  // --- State: インポートダイアログ ---
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // --- State: 一括選択 ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- State: Collection 編集/削除 ---
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [isCollectionFormVisible, setIsCollectionFormVisible] = useState(false);

  // --- Bookmark に Tag 名を付与した配列（検索用・カード表示用）---
  // bookmarkId → Tag名[] のマップを BookmarkTag 中間テーブルから構築する
  const tagById = useMemo(
    () => new Map(tags.map((t) => [t.id, t.name])),
    [tags],
  );

  // --- 未使用タグ数（一括削除ボタン用）---
  const unusedTagCount = useMemo(
    () => tags.filter((t) => t.bookmarkCount === 0).length,
    [tags],
  );

  const bookmarkTagMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const bt of bookmarkTags) {
      const tagName = tagById.get(bt.tagId);
      if (!tagName) continue;
      if (!map[bt.bookmarkId]) map[bt.bookmarkId] = [];
      // 重複排除
      if (!map[bt.bookmarkId].includes(tagName)) {
        map[bt.bookmarkId].push(tagName);
      }
    }
    return map;
  }, [bookmarkTags, tagById]);

  const bookmarksWithTags: BookmarkWithTags[] = useMemo(
    () =>
      bookmarks.map((b) => ({
        ...b,
        tags: bookmarkTagMap[b.id] ?? [],
      })),
    [bookmarks, bookmarkTagMap],
  );

  // --- 検索 ---
  const { results: searchResults, isSearching, query, setQuery } = useSearch(bookmarksWithTags);

  // --- フィルタ適用後の Bookmark 一覧 ---
  const filteredBookmarks = useMemo(() => {
    // 検索中は検索結果を使用
    let base: Bookmark[] =
      query.trim().length > 0 ? searchResults : bookmarks;

    // Collection フィルタ（collectionId フィールドベース）
    if (selectedCollectionId !== undefined) {
      base = filterBookmarksByCollectionId(base, selectedCollectionId);
    }

    // Tag フィルタ（AND 条件）
    if (selectedTagIds.length > 0) {
      base = filterBookmarksByTags(base, bookmarkTags, selectedTagIds);
    }

    // 読み物系ステータスフィルタ（isReadable === true のものだけ対象）
    if (selectedStatus !== null) {
      base = base.filter((b) => b.isReadable && b.status === selectedStatus);
    }

    return base;
  }, [
    query,
    searchResults,
    bookmarks,
    selectedCollectionId,
    bookmarkTags,
    selectedTagIds,
    selectedStatus,
  ]);

  // --- ソート適用 ---
  const sortedBookmarks = useMemo(
    () => sortBookmarks(filteredBookmarks),
    [sortBookmarks, filteredBookmarks],
  );

  // --- 読み物系ステータス別件数（isReadable === true のものだけカウント）---
  const statusCounts = useMemo(
    () => ({
      inbox: bookmarks.filter((b) => b.isReadable && b.status === "inbox").length,
      read: bookmarks.filter((b) => b.isReadable && b.status === "read").length,
      archived: bookmarks.filter((b) => b.isReadable && b.status === "archived").length,
    }),
    [bookmarks],
  );

  // --- Collection ごとの Bookmark 件数（collectionId フィールドベース）---
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookmarks) {
      if (b.collectionId) {
        counts[b.collectionId] = (counts[b.collectionId] ?? 0) + 1;
      }
    }
    return counts;
  }, [bookmarks]);

  // 未分類（collectionId が null のもの）件数
  const uncategorizedCount = useMemo(
    () => bookmarks.filter((b) => !b.collectionId).length,
    [bookmarks],
  );

  // --- Tag フィルタ操作 ---
  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTagIds([]);
  }, []);

  /**
   * Tag 名から Tag ID を解決する。既存 Tag があればその ID を返し、
   * なければ新規作成して ID を返す。
   */
  const resolveTagId = useCallback(
    async (tagName: string): Promise<string> => {
      const existing = tags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      );
      if (existing) {
        return existing.id;
      }
      const created = await createTag(tagName);
      return created.id;
    },
    [tags, createTag],
  );

  /**
   * Bookmark に Tag 名の配列を付与する。
   */
  const applyTagsToBookmark = useCallback(
    async (bookmarkId: string, tagNames: string[]) => {
      for (const tagName of tagNames) {
        if (!tagName.trim()) continue;
        try {
          const tagId = await resolveTagId(tagName.trim());
          await addTagToBookmark(tagId, bookmarkId);
        } catch (e) {
          console.error(`Tag "${tagName}" の付与に失敗:`, e);
        }
      }
    },
    [resolveTagId, addTagToBookmark],
  );

  // --- パイプライン: ref ベースのキューライフサイクル ---
  // Single AbortController for the entire pipeline session
  const pipelineAbortRef = useRef<AbortController | null>(null);

  // Stable queue refs (never recreated)
  const ogpQueueRef = useRef<OGPFetchQueue | null>(null);
  const enrichmentQueueRef = useRef<EnrichmentQueue | null>(null);

  // Fresh state refs for getter functions
  const tagsRef = useRef(tags);
  const collectionsRef = useRef(collections);
  const bookmarksRef = useRef(bookmarks);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { collectionsRef.current = collections; }, [collections]);
  useEffect(() => { bookmarksRef.current = bookmarks; }, [bookmarks]);

  // --- AI 補完キュー ---
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentQueueProgress | null>(null);
  const [ogpProgress, setOGPProgress] = useState<OGPFetchQueueProgress | null>(null);

  /**
   * AI 補完結果を Bookmark に適用する。
   * - hasCollectionId が false の場合のみ suggestedCollection を適用
   * - suggestedCollection が既存 Collection 名にマッチする場合のみ collectionId を設定
   * - suggestedTags は resolveTagId + addTagToBookmark で適用
   */
  const applyEnrichmentResult = useCallback(
    (itemResult: EnrichmentItemResult) => {
      const { bookmarkId, enrichmentResult, hasCollectionId } = itemResult;
      if (!enrichmentResult) return;

      const updates: Record<string, string> = {};
      // タイトル優先制御: 現在の bookmark にタイトルが設定されていない場合のみ suggestedTitle を適用
      const currentBookmark = bookmarks.find(b => b.id === bookmarkId);
      if (enrichmentResult.suggestedTitle && !currentBookmark?.title) {
        updates.title = enrichmentResult.suggestedTitle;
      }
      if (enrichmentResult.suggestedDescription) updates.description = enrichmentResult.suggestedDescription;
      if (enrichmentResult.suggestedMemo) updates.memo = enrichmentResult.suggestedMemo;

      // suggestedCollection の適用: hasCollectionId が false の場合のみ
      if (!hasCollectionId && enrichmentResult.suggestedCollection) {
        const matchedCollection = collections.find(
          (c) => c.name === enrichmentResult.suggestedCollection,
        );
        if (matchedCollection) {
          updates.collectionId = matchedCollection.id;
        } else {
          console.warn(
            "[AI] suggestedCollection が既存コレクションに一致しません:",
            JSON.stringify(enrichmentResult.suggestedCollection),
            "既存:",
            collections.map((c) => c.name),
          );
        }
      }

      if (Object.keys(updates).length > 0) {
        updateBookmark(bookmarkId, updates);
      }

      // suggestedTags の適用
      if (enrichmentResult.suggestedTags?.length > 0) {
        (async () => {
          for (const tagName of enrichmentResult.suggestedTags) {
            if (!tagName.trim()) continue;
            try {
              const tagId = await resolveTagId(tagName.trim());
              await addTagToBookmark(tagId, bookmarkId);
            } catch (e) {
              console.warn(`[AI] Tag "${tagName}" の付与に失敗:`, e);
            }
          }
          // タグ追加完了後にリフレッシュ
          await refreshTags();
        })();
      }
    },
    [bookmarks, collections, updateBookmark, resolveTagId, addTagToBookmark, refreshTags],
  );

  // applyEnrichmentResult ref to avoid stale closures
  const applyEnrichmentResultRef = useRef(applyEnrichmentResult);
  useEffect(() => { applyEnrichmentResultRef.current = applyEnrichmentResult; }, [applyEnrichmentResult]);

  // isAIEnabled ref to avoid stale closures in queue callbacks
  const isAIEnabledRef = useRef(isAIEnabled);
  useEffect(() => { isAIEnabledRef.current = isAIEnabled; }, [isAIEnabled]);

  // updateBookmark ref to avoid stale closures in queue callbacks
  const updateBookmarkRef = useRef(updateBookmark);
  useEffect(() => { updateBookmarkRef.current = updateBookmark; }, [updateBookmark]);

  /**
   * OGP フェッチ完了時のコールバック。
   * OGP 成功時にブックマーク更新 + AI 補完キューへのエンキューを行う。
   * タイトル優先制御: ユーザーが設定したタイトルがある場合は OGP タイトルで上書きしない。
   * Validates: Requirements 2.3, 3.1, 3.2, 3.3, 5.1, 5.2
   */
  const handleOGPItemComplete = useCallback((result: OGPFetchResult) => {
    if (!result.success) return;

    // Update bookmark with OGP data
    const updates: Record<string, string> = {};
    // タイトル優先制御: 現在の bookmark にタイトルが設定されていない場合のみ OGP タイトルを適用
    const currentBookmark = bookmarksRef.current.find(b => b.id === result.bookmarkId);
    if (result.title && !currentBookmark?.title) {
      updates.title = result.title;
    }
    if (result.description) updates.description = result.description;
    if (result.imageUrl) updates.ogpImageUrl = result.imageUrl;
    if (Object.keys(updates).length > 0) {
      updateBookmarkRef.current(result.bookmarkId, updates);
    }

    // Enqueue to AI enrichment (if enabled)
    if (isAIEnabledRef.current) {
      console.log("[AI] OGP完了 → AI enrichment enqueue:", result.bookmarkId, "enrichmentQueue exists:", !!enrichmentQueueRef.current);
      enrichmentQueueRef.current?.enqueue({
        bookmarkId: result.bookmarkId,
        url: result.url,
        ogpTitle: result.title || "",
        ogpDescription: result.description || "",
        hasCollectionId: result.hasCollectionId,
      });
    } else {
      console.log("[AI] AI enrichment disabled, skipping:", result.bookmarkId);
    }
  }, []);

  /**
   * OGP フェッチ全件完了時のコールバック。
   */
  const handleOGPComplete = useCallback((result: { totalProcessed: number; failedCount: number }) => {
    console.log("[OGP] 全件完了: %d 件処理, %d 件失敗", result.totalProcessed, result.failedCount);
  }, []);

  /**
   * AI 補完全件完了時のコールバック。
   * 完了後 3 秒で進捗表示をクリアし、ブックマーク・タグ一覧をリフレッシュする。
   */
  const handleEnrichmentComplete = useCallback(() => {
    setTimeout(() => setEnrichmentProgress(null), 3000);
    // AI 補完完了後にブックマーク・タグ一覧をリフレッシュ
    refreshBookmarks();
    refreshTags();
  }, [refreshBookmarks, refreshTags]);

  // Initialize queues once (lazy initialization via callback, not in a dependency-heavy useEffect)
  const getOrCreatePipeline = useCallback(() => {
    if (!pipelineAbortRef.current) {
      pipelineAbortRef.current = new AbortController();
    }
    if (!enrichmentQueueRef.current) {
      enrichmentQueueRef.current = new EnrichmentQueue({
        concurrency: 3,
        getExistingTags: () => tagsRef.current.map((t) => t.name),
        getExistingCollections: () => collectionsRef.current.map((c) => c.name),
        signal: pipelineAbortRef.current.signal,
        retryConfig: { maxRetries: 2, baseDelayMs: 1000 },
        onItemComplete: (result) => {
          if (!result.enrichmentResult) return;
          applyEnrichmentResultRef.current(result);
        },
        onProgress: setEnrichmentProgress,
        onComplete: handleEnrichmentComplete,
      });
    }
    if (!ogpQueueRef.current) {
      ogpQueueRef.current = new OGPFetchQueue({
        concurrency: 5,
        signal: pipelineAbortRef.current.signal,
        retryConfig: { maxRetries: 2, baseDelayMs: 1000 },
        onItemComplete: handleOGPItemComplete,
        onProgress: setOGPProgress,
        onComplete: handleOGPComplete,
      });
    }
    return { ogpQueue: ogpQueueRef.current, enrichmentQueue: enrichmentQueueRef.current };
  }, [handleOGPItemComplete, handleOGPComplete, handleEnrichmentComplete]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      pipelineAbortRef.current?.abort();
      ogpQueueRef.current?.abort();
      enrichmentQueueRef.current?.abort();
    };
  }, []);

  /**
   * 新規作成されたブックマークの OGP を API Route 経由でバックグラウンド取得し、DB を更新する。
   * OGP 取得成功後に AI 補完キューに enqueue する。
   * OGPFetchQueue を使用し、コンカレンシー制御・リトライ・安定した AbortController を実現。
   * @param items - OGP 取得対象のブックマーク配列
   * @param options.hasCollectionId - enqueue 時に hasCollectionId として渡す値（デフォルト false）
   */
  const triggerOGPFetch = useCallback(
    (items: Array<{ id: string; url: string }>, options?: { hasCollectionId?: boolean }) => {
      if (items.length === 0) return;
      const hasCollectionId = options?.hasCollectionId ?? false;
      console.log("[OGP] triggerOGPFetch: %d 件の OGP 取得開始 (hasCollectionId=%s)", items.length, hasCollectionId);

      const { ogpQueue } = getOrCreatePipeline();
      const batch = items
        .filter((item) => !!item.url)
        .map((item) => ({
          bookmarkId: item.id,
          url: item.url,
          hasCollectionId,
        }));
      ogpQueue.enqueueBatch(batch);
    },
    [getOrCreatePipeline],
  );

  // --- Bookmark 作成/編集 ---
  const handleQuickAdd = useCallback(
    async (url: string, title?: string) => {
      const input: BookmarkInput = { url };
      if (title) input.title = title;
      const created = await createBookmark(input);
      // バックグラウンドでOGP（タイトル・画像）を取得して更新
      triggerOGPFetch([{ id: created.id, url: created.url }]);
    },
    [createBookmark, triggerOGPFetch],
  );

  const handleFormSubmit = useCallback(
    async (data: BookmarkInput, formTags: string[]) => {
      if (editingBookmark) {
        await updateBookmark(editingBookmark.id, data);
        await applyTagsToBookmark(editingBookmark.id, formTags);
      } else {
        const existing = await checkDuplicate(data.url);
        if (existing) {
          setDuplicateBookmark(existing);
          setPendingInput({ data, tags: formTags });
          return;
        }
        const created = await createBookmark(data);
        await applyTagsToBookmark(created.id, formTags);
        triggerOGPFetch([{ id: created.id, url: data.url }]);
      }
    },
    [
      editingBookmark,
      updateBookmark,
      checkDuplicate,
      createBookmark,
      applyTagsToBookmark,
      triggerOGPFetch,
    ],
  );

  const handleFormCancel = useCallback(() => {
    setIsFormVisible(false);
    setEditingBookmark(null);
  }, []);

  // --- 重複ダイアログ操作 ---
  const handleDuplicateContinue = useCallback(async () => {
    if (!pendingInput) return;
    const created = await createBookmark(pendingInput.data);
    await applyTagsToBookmark(created.id, pendingInput.tags);
    triggerOGPFetch([{ id: created.id, url: pendingInput.data.url }]);
    setDuplicateBookmark(null);
    setPendingInput(null);
    setIsFormVisible(false);
  }, [pendingInput, createBookmark, applyTagsToBookmark, triggerOGPFetch]);

  const handleDuplicateCancel = useCallback(() => {
    setDuplicateBookmark(null);
    setPendingInput(null);
  }, []);

  // --- 編集 ---
  const handleEdit = useCallback(
    (id: string) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        setEditingBookmark(bookmark);
        setIsFormVisible(true);
      }
    },
    [bookmarks],
  );

  // --- 削除 ---
  const handleDeleteRequest = useCallback(
    (id: string) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        setDeletingBookmark(bookmark);
      }
    },
    [bookmarks],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingBookmark) return;
    await deleteBookmark(deletingBookmark.id);
    setDeletingBookmark(null);
    // 関連タグのカウントを更新
    await refreshTags();
  }, [deletingBookmark, deleteBookmark, refreshTags]);

  const handleDeleteCancel = useCallback(() => {
    setDeletingBookmark(null);
  }, []);

  // --- リンククリック（アクセス追跡 + 新しいタブで開く） ---
  const handleLinkClick = useCallback(
    (id: string) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        trackAccess(id);
        window.open(bookmark.url, "_blank", "noopener,noreferrer");
      }
    },
    [bookmarks, trackAccess],
  );

  // --- ステータス変更 ---
  const handleStatusChange = useCallback(
    (id: string, status: BookmarkStatus) => {
      updateBookmarkStatus(id, status);
    },
    [updateBookmarkStatus],
  );

  // --- Collection 割り当てダイアログを開く ---
  const handleAssignCollection = useCallback((bookmarkId: string) => {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (bookmark) {
      setAssigningBookmark(bookmark);
    }
  }, [bookmarks]);

  const handleAssign = useCallback(async (collectionId: string | null) => {
    if (!assigningBookmark) return;
    await updateBookmark(assigningBookmark.id, { collectionId });
  }, [assigningBookmark, updateBookmark]);

  // --- Collection 操作 ---
  const handleCollectionCreateNew = useCallback(() => {
    setEditingCollection(null);
    setIsCollectionFormVisible(true);
  }, []);

  const handleCollectionEdit = useCallback(
    (id: string) => {
      const collection = collections.find((c) => c.id === id);
      if (collection) {
        setEditingCollection(collection);
        setIsCollectionFormVisible(true);
      }
    },
    [collections],
  );

  const handleCollectionDeleteRequest = useCallback(
    (id: string) => {
      const collection = collections.find((c) => c.id === id);
      if (collection) {
        setDeletingCollection(collection);
      }
    },
    [collections],
  );

  const handleCollectionFormSubmit = useCallback(
    async (input: CollectionInput) => {
      if (editingCollection) {
        await updateCollection(editingCollection.id, input);
      } else {
        await createCollection(input);
      }
      setIsCollectionFormVisible(false);
      setEditingCollection(null);
    },
    [editingCollection, updateCollection, createCollection],
  );

  const handleCollectionFormCancel = useCallback(() => {
    setIsCollectionFormVisible(false);
    setEditingCollection(null);
  }, []);

  const handleCollectionDeleteConfirm = useCallback(async () => {
    if (!deletingCollection) return;
    await deleteCollection(deletingCollection.id);
    // 削除した Collection が選択中だった場合、「すべて」にリセット
    if (selectedCollectionId === deletingCollection.id) {
      setSelectedCollectionId(undefined);
    }
    setDeletingCollection(null);
  }, [deletingCollection, deleteCollection, selectedCollectionId]);

  const handleCollectionDeleteCancel = useCallback(() => {
    setDeletingCollection(null);
  }, []);

  // --- インポート完了 ---
  const handleImportComplete = useCallback(async (collectionMode: ImportCollectionMode) => {
    // インポート後にブックマーク一覧をリフレッシュ
    console.log("[OGP] インポート完了 (collectionMode=%s) → リフレッシュ開始", collectionMode);
    await refreshBookmarks();
    console.log("[OGP] リフレッシュ完了 → 全件 OGP チェック開始");

    // 全ブックマークから OGP 未取得分を取得（ページネーションに依存しない）
    const allBookmarks = await fetchAllBookmarkUrls();
    const needsOGP = allBookmarks
      .filter((b) => !b.ogpImageUrl && b.url)
      .map((b) => ({ id: b.id, url: b.url }));
    console.log("[OGP] OGP 未取得: %d / %d 件", needsOGP.length, allBookmarks.length);
    if (needsOGP.length > 0) {
      // folder-inherit モード: collectionId が既に設定されているため hasCollectionId: true
      // flat モード: collectionId が null のため hasCollectionId: false
      triggerOGPFetch(needsOGP, { hasCollectionId: collectionMode === "folder-inherit" });
    }
  }, [refreshBookmarks, fetchAllBookmarkUrls, triggerOGPFetch]);

  // --- 一括選択操作 ---
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = sortedBookmarks.map((b) => b.id);
    setSelectedIds((prev) => {
      if (prev.size === allIds.length) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, [sortedBookmarks]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `${selectedIds.size} 件のブックマークを削除しますか？`,
    );
    if (!confirmed) return;
    for (const id of Array.from(selectedIds)) {
      await deleteBookmark(id);
    }
    setSelectedIds(new Set());
    await refreshTags();
  }, [selectedIds, deleteBookmark, refreshTags]);

  return (
    <DndProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      activeId={activeId}
      activeBookmark={activeBookmark}
    >
      <main className={styles.main}>
      {/* 重複通知トースト (Requirement 2.5) */}
      {duplicateNotification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "5rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            color: "#78350f",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            maxWidth: "90vw",
          }}
        >
          <span style={{ fontSize: "0.875rem" }}>{duplicateNotification}</span>
          <button
            type="button"
            onClick={dismissNotification}
            style={{
              border: "none",
              background: "transparent",
              color: "#78350f",
              cursor: "pointer",
              fontSize: "1rem",
              padding: "0 0.25rem",
              lineHeight: 1,
            }}
            aria-label="通知を閉じる"
          >
            ×
          </button>
        </div>
      )}
      {/* ヘッダー */}
      <header className={styles.header}>
        {isMobile && (
          <button
            type="button"
            className={styles.hamburgerButton}
            onClick={() => {
              setIsMobileMenuOpen(true);
              setIsMobileChatOpen(false);
            }}
            aria-label="メニューを開く"
          >
            ☰
          </button>
        )}
        <h1 className={styles.title}>Rich Browser Link</h1>
        {isMobile && (
          <button
            type="button"
            className={styles.chatToggleButton}
            onClick={() => {
              setIsMobileChatOpen(true);
              setIsMobileMenuOpen(false);
            }}
            aria-label="チャットを開く"
          >
            💬
          </button>
        )}
        <div className={styles.headerActions}>
          <label className={styles.aiToggle}>
            <input
              type="checkbox"
              checked={isAIEnabled}
              onChange={(e) => setAIEnabled(e.target.checked)}
            />
            <span>AI 補完</span>
          </label>
          <button
            type="button"
            className={styles.importButton}
            onClick={() => setIsImportDialogOpen(true)}
          >
            インポート
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              setEditingBookmark(null);
              setIsFormVisible(true);
            }}
          >
            + 新規作成
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* モバイルサイドバーオーバーレイ */}
        <MobileSidebarOverlay
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          <CollectionList
            collectionTree={collectionTree}
            selectedId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
            onCreateNew={handleCollectionCreateNew}
            onEdit={handleCollectionEdit}
            onDelete={handleCollectionDeleteRequest}
            onMove={moveCollection}
            counts={collectionCounts}
            uncategorizedCount={uncategorizedCount}
            totalCount={bookmarks.length}
          />
          {isCollectionFormVisible && (
            <CollectionForm
              collection={editingCollection ?? undefined}
              collections={collections}
              onSubmit={handleCollectionFormSubmit}
              onCancel={handleCollectionFormCancel}
            />
          )}
          <TagFilter
            tags={tags}
            selectedTagIds={selectedTagIds}
            onToggleTag={handleToggleTag}
            onClear={handleClearTags}
            onDeleteTag={deleteTag}
            onDeleteUnusedTags={deleteUnusedTags}
            unusedTagCount={unusedTagCount}
          />
          <StatusFilter
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            counts={statusCounts}
          />
        </MobileSidebarOverlay>

        {/* モバイルチャットオーバーレイ */}
        <MobileChatOverlay
          isOpen={isMobileChatOpen}
          onClose={() => setIsMobileChatOpen(false)}
        >
          <AgentChatSection runtimeArn={RUNTIME_ARN} onResponseComplete={() => { refreshBookmarks(); refreshTags(); }} />
        </MobileChatOverlay>

        {/* 左サイドバー（デスクトップのみ） */}
        {!isMobile && (
          <ResizableSidebar
            side="left"
            defaultWidth={240}
            minWidth={160}
            maxWidth={400}
            collapseThreshold={80}
            collapsed={isSidebarCollapsed}
            onCollapsedChange={setIsSidebarCollapsed}
          >
            <CollectionList
              collectionTree={collectionTree}
              selectedId={selectedCollectionId}
              onSelect={setSelectedCollectionId}
              onCreateNew={handleCollectionCreateNew}
              onEdit={handleCollectionEdit}
              onDelete={handleCollectionDeleteRequest}
              onMove={moveCollection}
              counts={collectionCounts}
              uncategorizedCount={uncategorizedCount}
              totalCount={bookmarks.length}
            />
            {isCollectionFormVisible && (
              <CollectionForm
                collection={editingCollection ?? undefined}
                collections={collections}
                onSubmit={handleCollectionFormSubmit}
                onCancel={handleCollectionFormCancel}
              />
            )}
            <TagFilter
              tags={tags}
              selectedTagIds={selectedTagIds}
              onToggleTag={handleToggleTag}
              onClear={handleClearTags}
              onDeleteTag={deleteTag}
              onDeleteUnusedTags={deleteUnusedTags}
              unusedTagCount={unusedTagCount}
            />
            <StatusFilter
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              counts={statusCounts}
            />
          </ResizableSidebar>
        )}

        {/* メインコンテンツ */}
        <section className={styles.content}>
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            isSearching={isSearching}
            resultCount={
              query.trim().length > 0 ? searchResults.length : undefined
            }
          />

          <QuickAdd onAdd={handleQuickAdd} checkDuplicate={checkDuplicate} />

          <BookmarkToolbar
            displayMode={effectiveDisplayMode}
            onDisplayModeChange={setDisplayMode}
            sortKey={sortKey}
            onSortChange={setSortKey}
          />

          <PipelineProgress ogpProgress={ogpProgress} enrichmentProgress={enrichmentProgress} />

          {/* 一括選択バー */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.25rem 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={sortedBookmarks.length > 0 && selectedIds.size === sortedBookmarks.length}
                onChange={handleSelectAll}
                style={{ width: "1rem", height: "1rem" }}
              />
              全選択
            </label>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                style={{
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.8rem",
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                {selectedIds.size} 件を削除
              </button>
            )}
          </div>

          {effectiveDisplayMode === "list" && (
            <BookmarkList
              bookmarks={sortedBookmarks}
              tagsByBookmarkId={bookmarkTagMap}
              isLoading={isBookmarksLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onLinkClick={handleLinkClick}
              onStatusChange={handleStatusChange}
              onAssignCollection={handleAssignCollection}
              onToggleReadable={toggleReadable}
              onTogglePin={togglePin}
              allTags={tags}
              onAddTag={addTagToBookmark}
              onRemoveTag={removeTagFromBookmark}
              onCreateTag={createTag}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          )}

          {effectiveDisplayMode === "grid" && (
            <BookmarkGrid
              bookmarks={sortedBookmarks}
              tagsByBookmarkId={bookmarkTagMap}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onLinkClick={handleLinkClick}
              onStatusChange={handleStatusChange}
              onAssignCollection={handleAssignCollection}
              onToggleReadable={toggleReadable}
              onTogglePin={togglePin}
              allTags={tags}
              onAddTag={addTagToBookmark}
              onRemoveTag={removeTagFromBookmark}
              onCreateTag={createTag}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          )}

          {effectiveDisplayMode === "compact" && (
            <BookmarkCompactList
              bookmarks={sortedBookmarks}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onLinkClick={handleLinkClick}
            />
          )}
        </section>

        {/* 右チャットパネル（デスクトップのみ） */}
        {!isMobile && (
          <ResizableSidebar
            side="right"
            defaultWidth={420}
            minWidth={280}
            maxWidth={800}
            collapseThreshold={100}
            collapsed={isChatCollapsed}
            onCollapsedChange={setIsChatCollapsed}
          >
            <AgentChatSection runtimeArn={RUNTIME_ARN} onResponseComplete={() => { refreshBookmarks(); refreshTags(); }} />
          </ResizableSidebar>
        )}
      </div>

      {/* ダイアログ群 */}
      <BookmarkDeleteDialog
        isOpen={deletingBookmark !== null}
        bookmark={deletingBookmark}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <DuplicateDialog
        isOpen={duplicateBookmark !== null}
        existingBookmark={duplicateBookmark}
        onContinue={handleDuplicateContinue}
        onCancel={handleDuplicateCancel}
      />

      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <CollectionDeleteDialog
        collectionName={deletingCollection?.name ?? ""}
        isOpen={deletingCollection !== null}
        onConfirm={handleCollectionDeleteConfirm}
        onCancel={handleCollectionDeleteCancel}
      />

      {assigningBookmark && (
        <CollectionAssignDialog
          bookmark={assigningBookmark}
          collectionTree={collectionTree}
          onAssign={handleAssign}
          onClose={() => setAssigningBookmark(null)}
        />
      )}

      <BookmarkFormDialog
        isOpen={isFormVisible}
        onClose={handleFormCancel}
        bookmark={editingBookmark ?? undefined}
        onSubmit={handleFormSubmit}
      />
      </main>
    </DndProvider>
  );
}
