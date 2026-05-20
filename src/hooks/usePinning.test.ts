import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePinning } from "./usePinning";
import type { Bookmark } from "@/src/types";

/** テスト用のブックマークを生成するヘルパー */
function createBookmark(
  id: string,
  overrides: Partial<Bookmark> = {},
): Bookmark {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
    description: "",
    memo: "",
    ogpImageUrl: "",
    status: "inbox",
    accessCount: 0,
    lastAccessedAt: "",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    owner: "user1",
    isReadable: false,
    sortOrder: 0,
    pinned: false,
    collectionId: null,
    ...overrides,
  };
}

describe("usePinning", () => {
  describe("togglePin", () => {
    it("pinned=false のブックマークを pinned=true に更新する", async () => {
      const bookmark = createBookmark("a", { pinned: false });
      const updateBookmark = vi.fn().mockResolvedValue({ ...bookmark, pinned: true });

      const { result } = renderHook(() =>
        usePinning({ bookmarks: [bookmark], updateBookmark }),
      );

      await act(async () => {
        await result.current.togglePin("a");
      });

      expect(updateBookmark).toHaveBeenCalledWith("a", { pinned: true });
    });

    it("pinned=true のブックマークを pinned=false に更新する", async () => {
      const bookmark = createBookmark("a", { pinned: true });
      const updateBookmark = vi.fn().mockResolvedValue({ ...bookmark, pinned: false });

      const { result } = renderHook(() =>
        usePinning({ bookmarks: [bookmark], updateBookmark }),
      );

      await act(async () => {
        await result.current.togglePin("a");
      });

      expect(updateBookmark).toHaveBeenCalledWith("a", { pinned: false });
    });

    it("存在しない ID の場合は updateBookmark を呼ばない", async () => {
      const bookmark = createBookmark("a");
      const updateBookmark = vi.fn().mockResolvedValue(bookmark);

      const { result } = renderHook(() =>
        usePinning({ bookmarks: [bookmark], updateBookmark }),
      );

      await act(async () => {
        await result.current.togglePin("nonexistent");
      });

      expect(updateBookmark).not.toHaveBeenCalled();
    });
  });

  describe("sortWithPinning", () => {
    it("pinned=true のアイテムを先頭に配置する", () => {
      const bookmarks = [
        createBookmark("a", { pinned: false }),
        createBookmark("b", { pinned: true }),
        createBookmark("c", { pinned: false }),
      ];
      const updateBookmark = vi.fn().mockResolvedValue(bookmarks[0]);

      const { result } = renderHook(() =>
        usePinning({ bookmarks, updateBookmark }),
      );

      const sorted = result.current.sortWithPinning(bookmarks);
      expect(sorted[0].id).toBe("b");
      expect(sorted[1].id).toBe("a");
      expect(sorted[2].id).toBe("c");
    });

    it("全て unpinned の場合は元の順序を維持する", () => {
      const bookmarks = [
        createBookmark("a", { pinned: false }),
        createBookmark("b", { pinned: false }),
        createBookmark("c", { pinned: false }),
      ];
      const updateBookmark = vi.fn().mockResolvedValue(bookmarks[0]);

      const { result } = renderHook(() =>
        usePinning({ bookmarks, updateBookmark }),
      );

      const sorted = result.current.sortWithPinning(bookmarks);
      expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c"]);
    });

    it("全て pinned の場合は元の順序を維持する", () => {
      const bookmarks = [
        createBookmark("a", { pinned: true }),
        createBookmark("b", { pinned: true }),
        createBookmark("c", { pinned: true }),
      ];
      const updateBookmark = vi.fn().mockResolvedValue(bookmarks[0]);

      const { result } = renderHook(() =>
        usePinning({ bookmarks, updateBookmark }),
      );

      const sorted = result.current.sortWithPinning(bookmarks);
      expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c"]);
    });

    it("各グループ内の相対順序を維持する", () => {
      const bookmarks = [
        createBookmark("a", { pinned: false }),
        createBookmark("b", { pinned: true }),
        createBookmark("c", { pinned: true }),
        createBookmark("d", { pinned: false }),
      ];
      const updateBookmark = vi.fn().mockResolvedValue(bookmarks[0]);

      const { result } = renderHook(() =>
        usePinning({ bookmarks, updateBookmark }),
      );

      const sorted = result.current.sortWithPinning(bookmarks);
      // pinned グループ: b, c（元の順序維持）
      // unpinned グループ: a, d（元の順序維持）
      expect(sorted.map((b) => b.id)).toEqual(["b", "c", "a", "d"]);
    });

    it("空配列を渡すと空配列を返す", () => {
      const updateBookmark = vi.fn().mockResolvedValue({} as Bookmark);

      const { result } = renderHook(() =>
        usePinning({ bookmarks: [], updateBookmark }),
      );

      const sorted = result.current.sortWithPinning([]);
      expect(sorted).toEqual([]);
    });
  });
});
