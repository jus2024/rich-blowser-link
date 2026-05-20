import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock all hooks ---
const mockUseMediaQuery = vi.fn<(query: string) => boolean>();
vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

vi.mock("@/src/hooks/useBookmarks", () => ({
  useBookmarks: () => ({
    bookmarks: [],
    isLoading: false,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    fetchAllBookmarkUrls: vi.fn().mockResolvedValue([]),
    createBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    checkDuplicate: vi.fn(),
    updateBookmarkStatus: vi.fn(),
    toggleReadable: vi.fn(),
    reorderBookmarks: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useCollections", () => ({
  useCollections: () => ({
    collections: [],
    collectionTree: [],
    bookmarkCollections: [],
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    moveCollection: vi.fn(),
    deleteCollection: vi.fn(),
    addBookmarkToCollection: vi.fn(),
    removeBookmarkFromCollection: vi.fn(),
    checkBookmarkInCollection: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useSearch", () => ({
  useSearch: () => ({
    results: [],
    isSearching: false,
    query: "",
    setQuery: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useTags", () => ({
  useTags: () => ({
    tags: [],
    bookmarkTags: [],
    addTagToBookmark: vi.fn(),
    removeTagFromBookmark: vi.fn(),
    createTag: vi.fn(),
    deleteTag: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useDisplayMode", () => ({
  useDisplayMode: () => ({
    displayMode: "list",
    setDisplayMode: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useSort", () => ({
  useSort: () => ({
    sortKey: "createdAt",
    setSortKey: vi.fn(),
    sortBookmarks: (b: unknown[]) => b,
  }),
}));

vi.mock("@/src/hooks/useAccessTracker", () => ({
  useAccessTracker: () => ({
    trackAccess: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/usePinning", () => ({
  usePinning: () => ({
    togglePin: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useAIEnrichment", () => ({
  useAIEnrichment: () => ({
    isAIEnabled: false,
    setAIEnabled: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useDragAndDrop", () => ({
  useDragAndDrop: () => ({
    activeId: null,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragCancel: vi.fn(),
    duplicateNotification: null,
    dismissNotification: vi.fn(),
  }),
}));

// --- Mock child components to simplify rendering ---
vi.mock("@/src/components/agent/AgentChatSection", () => ({
  default: ({ runtimeArn }: { runtimeArn?: string }) => (
    <div data-testid="agent-chat-section" data-runtime-arn={runtimeArn ?? ""}>
      AgentChatSection
    </div>
  ),
}));

vi.mock("@/src/components/layout/ResizableSidebar", () => ({
  ResizableSidebar: ({ children, side }: { children: React.ReactNode; side: string }) => (
    <div data-testid={`resizable-sidebar-${side}`}>{children}</div>
  ),
}));

vi.mock("@/src/components/layout/MobileSidebarOverlay", () => ({
  MobileSidebarOverlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="mobile-sidebar-overlay">{children}</div> : null,
}));

vi.mock("@/src/components/layout/MobileChatOverlay", () => ({
  MobileChatOverlay: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="mobile-chat-overlay">{children}</div> : null,
}));

vi.mock("@/src/components/dnd/DndProvider", () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/src/components/bookmark/BookmarkList", () => ({
  BookmarkList: () => <div data-testid="bookmark-list" />,
}));

vi.mock("@/src/components/bookmark/BookmarkGrid", () => ({
  BookmarkGrid: () => <div data-testid="bookmark-grid" />,
}));

vi.mock("@/src/components/bookmark/BookmarkCompactList", () => ({
  BookmarkCompactList: () => <div data-testid="bookmark-compact-list" />,
}));

vi.mock("@/src/components/bookmark/BookmarkToolbar", () => ({
  BookmarkToolbar: () => <div data-testid="bookmark-toolbar" />,
}));

vi.mock("@/src/components/bookmark/BookmarkDeleteDialog", () => ({
  BookmarkDeleteDialog: () => null,
}));

vi.mock("@/src/components/bookmark/BookmarkFormDialog", () => ({
  BookmarkFormDialog: () => null,
}));

vi.mock("@/src/components/bookmark/DuplicateDialog", () => ({
  DuplicateDialog: () => null,
}));

vi.mock("@/src/components/bookmark/QuickAdd", () => ({
  QuickAdd: () => <div data-testid="quick-add" />,
}));

vi.mock("@/src/components/collection/CollectionList", () => ({
  CollectionList: () => <div data-testid="collection-list" />,
}));

vi.mock("@/src/components/collection/CollectionForm", () => ({
  CollectionForm: () => null,
}));

vi.mock("@/src/components/collection/CollectionDeleteDialog", () => ({
  CollectionDeleteDialog: () => null,
}));

vi.mock("@/src/components/collection/CollectionAssignDialog", () => ({
  CollectionAssignDialog: () => null,
}));

vi.mock("@/src/components/import/ImportDialog", () => ({
  ImportDialog: () => null,
}));

vi.mock("@/src/components/ai/EnrichmentProgressBar", () => ({
  EnrichmentProgressBar: () => null,
}));

vi.mock("@/src/components/search/SearchBar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

vi.mock("@/src/components/filter/StatusFilter", () => ({
  StatusFilter: () => <div data-testid="status-filter" />,
}));

vi.mock("@/src/components/tag/TagFilter", () => ({
  TagFilter: () => <div data-testid="tag-filter" />,
}));

vi.mock("@/src/lib/ai/enrichmentQueue", () => ({
  EnrichmentQueue: class MockEnrichmentQueue {
    enqueue = vi.fn();
    abort = vi.fn();
    constructor() {}
  },
}));

// Import the component under test after mocks
import Home from "./page";

describe("デスクトップ表示との整合性 (Requirements 5.1, 5.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("デスクトップ表示 (!isMobile)", () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(false); // not mobile
    });

    it("AgentChatSection が ResizableSidebar(right) 内に表示される", () => {
      render(<Home />);

      const rightSidebar = screen.getByTestId("resizable-sidebar-right");
      expect(rightSidebar).toBeInTheDocument();

      // AgentChatSection が右サイドバー内に存在する
      const chatSection = screen.getByTestId("agent-chat-section");
      expect(rightSidebar).toContainElement(chatSection);
    });

    it("MobileChatOverlay は表示されない", () => {
      render(<Home />);

      expect(screen.queryByTestId("mobile-chat-overlay")).not.toBeInTheDocument();
    });

    it("チャットトグルボタンは表示されない", () => {
      render(<Home />);

      expect(screen.queryByLabelText("チャットを開く")).not.toBeInTheDocument();
    });
  });

  describe("モバイル表示 (isMobile)", () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true); // mobile
    });

    it("ResizableSidebar(right) 内の AgentChatSection が非表示である", () => {
      render(<Home />);

      // 右サイドバー自体がレンダリングされない
      expect(screen.queryByTestId("resizable-sidebar-right")).not.toBeInTheDocument();
    });

    it("AgentChatSection は MobileChatOverlay 経由でのみアクセス可能（初期状態では非表示）", () => {
      render(<Home />);

      // MobileChatOverlay は初期状態で閉じている（isOpen=false → null）
      expect(screen.queryByTestId("mobile-chat-overlay")).not.toBeInTheDocument();
      // AgentChatSection もレンダリングされていない
      expect(screen.queryByTestId("agent-chat-section")).not.toBeInTheDocument();
    });

    it("チャットトグルボタンが表示される", () => {
      render(<Home />);

      expect(screen.getByLabelText("チャットを開く")).toBeInTheDocument();
    });
  });
});
