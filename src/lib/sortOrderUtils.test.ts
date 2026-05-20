import { describe, it, expect } from "vitest";
import { calculateNewSortOrders } from "./sortOrderUtils";
import type { Bookmark } from "@/src/types";

/** テスト用のブックマークを生成するヘルパー */
function createBookmark(id: string, sortOrder: number): Bookmark {
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
    sortOrder,
    pinned: false,
    collectionId: null,
  };
}

describe("calculateNewSortOrders", () => {
  it("同じ位置への移動は空配列を返す", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 1000),
      createBookmark("c", 2000),
    ];
    const result = calculateNewSortOrders(bookmarks, 1, 1);
    expect(result).toEqual([]);
  });

  it("範囲外のインデックスは空配列を返す", () => {
    const bookmarks = [createBookmark("a", 0), createBookmark("b", 1000)];
    expect(calculateNewSortOrders(bookmarks, -1, 0)).toEqual([]);
    expect(calculateNewSortOrders(bookmarks, 0, 5)).toEqual([]);
  });

  it("前後の中間値が整数の場合、移動した要素のみ更新する", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 1000),
      createBookmark("c", 2000),
    ];
    // b を先頭に移動 (index 1 → index 0)
    // 移動後: [b, a, c]
    // b の新しい sortOrder = a の前 = 0 - 1000 = -1000
    const result = calculateNewSortOrders(bookmarks, 1, 0);
    expect(result).toEqual([{ id: "b", sortOrder: -1000 }]);
  });

  it("末尾への移動は前の要素 + INTERVAL を使用する", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 1000),
      createBookmark("c", 2000),
    ];
    // a を末尾に移動 (index 0 → index 2)
    // 移動後: [b, c, a]
    // a の新しい sortOrder = c の後 = 2000 + 1000 = 3000
    const result = calculateNewSortOrders(bookmarks, 0, 2);
    expect(result).toEqual([{ id: "a", sortOrder: 3000 }]);
  });

  it("中間位置への移動は前後の中間値を使用する", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 1000),
      createBookmark("c", 2000),
    ];
    // a を index 1 に移動 (index 0 → index 1)
    // 移動後: [b, a, c]
    // a の新しい sortOrder = floor((1000 + 2000) / 2) = 1500
    const result = calculateNewSortOrders(bookmarks, 0, 1);
    expect(result).toEqual([{ id: "a", sortOrder: 1500 }]);
  });

  it("中間値が衝突する場合は全体を再番号付けする", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 1),
      createBookmark("c", 2),
    ];
    // a を index 1 に移動 (index 0 → index 1)
    // 移動後: [b, a, c]
    // 中間値 = floor((1 + 2) / 2) = 1 → b と衝突
    const result = calculateNewSortOrders(bookmarks, 0, 1);
    // 全体再番号付け: b=0, a=1000, c=2000
    expect(result).toContainEqual({ id: "b", sortOrder: 0 });
    expect(result).toContainEqual({ id: "a", sortOrder: 1000 });
    expect(result).toContainEqual({ id: "c", sortOrder: 2000 });
  });

  it("再番号付け時に変更のない要素は含まない", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 1000),
      createBookmark("c", 1001),
    ];
    // c を index 1 に移動 (index 2 → index 1)
    // 移動後: [a, c, b]
    // 中間値 = floor((0 + 1000) / 2) = 500 → 衝突なし、整数
    const result = calculateNewSortOrders(bookmarks, 2, 1);
    expect(result).toEqual([{ id: "c", sortOrder: 500 }]);
  });

  it("結果の sortOrder は単調増加になる", () => {
    const bookmarks = [
      createBookmark("a", 0),
      createBookmark("b", 500),
      createBookmark("c", 1000),
      createBookmark("d", 1500),
    ];
    // d を先頭に移動
    const result = calculateNewSortOrders(bookmarks, 3, 0);

    // 結果を適用して検証
    const updated = bookmarks.map((b) => {
      const update = result.find((u) => u.id === b.id);
      return { ...b, sortOrder: update ? update.sortOrder : b.sortOrder };
    });

    // 移動後の配列を構築
    const reordered = [...bookmarks];
    const [moved] = reordered.splice(3, 1);
    reordered.splice(0, 0, moved);

    const finalOrder = reordered.map((b) => {
      const update = result.find((u) => u.id === b.id);
      return update ? update.sortOrder : b.sortOrder;
    });

    // 単調増加を検証
    for (let i = 0; i < finalOrder.length - 1; i++) {
      expect(finalOrder[i]).toBeLessThan(finalOrder[i + 1]);
    }
  });

  it("2要素の配列で正しく動作する", () => {
    const bookmarks = [createBookmark("a", 0), createBookmark("b", 1000)];
    // b を先頭に移動
    const result = calculateNewSortOrders(bookmarks, 1, 0);
    expect(result).toEqual([{ id: "b", sortOrder: -1000 }]);
  });
});
