import { describe, expect, it } from "vitest";

import { DEFAULT_BATCH_SIZE, splitIntoBatches } from "./batchProcessor";

describe("splitIntoBatches", () => {
  it("returns an empty array for an empty input", () => {
    expect(splitIntoBatches([])).toEqual([]);
  });

  it("returns a single batch when input length is less than batchSize", () => {
    const items = [1, 2, 3];
    expect(splitIntoBatches(items, 50)).toEqual([[1, 2, 3]]);
  });

  it("returns a single batch when input length equals batchSize", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = splitIntoBatches(items, 50);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(50);
    expect(result[0]).toEqual(items);
  });

  it("splits items into fixed-size batches of 50 by default", () => {
    const items = Array.from({ length: 125 }, (_, i) => i);
    const result = splitIntoBatches(items);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(DEFAULT_BATCH_SIZE);
    expect(result[1]).toHaveLength(DEFAULT_BATCH_SIZE);
    expect(result[2]).toHaveLength(25);
  });

  it("preserves the original order across batches", () => {
    const items = Array.from({ length: 7 }, (_, i) => i);
    const result = splitIntoBatches(items, 3);

    expect(result).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6],
    ]);
    expect(result.flat()).toEqual(items);
  });

  it("respects a custom batchSize", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = splitIntoBatches(items, 4);

    expect(result).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9],
    ]);
  });

  it("throws a RangeError when batchSize is 0", () => {
    expect(() => splitIntoBatches([1, 2, 3], 0)).toThrow(RangeError);
  });

  it("throws a RangeError when batchSize is negative", () => {
    expect(() => splitIntoBatches([1, 2, 3], -1)).toThrow(RangeError);
  });

  it("throws a RangeError when batchSize is not an integer", () => {
    expect(() => splitIntoBatches([1, 2, 3], 2.5)).toThrow(RangeError);
  });

  it("DEFAULT_BATCH_SIZE is 50", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(50);
  });
});

import { processBatches } from "./batchProcessor";
import type { BatchItemResult } from "./batchProcessor";
import type { ImportProgress } from "./types";

describe("processBatches", () => {
  it("creates every item across multiple batches and reports cumulative progress", async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      url: `https://example.com/${i}`,
    }));
    const created: string[] = [];
    const progressSnapshots: ImportProgress[] = [];
    const batchSnapshots: Array<[number, BatchItemResult<string>[]]> = [];

    const result = await processBatches<{ url: string }, string>(
      {
        items,
        createItem: async (item) => {
          created.push(item.url);
          return `ok:${item.url}`;
        },
        batchSize: 3,
        batchDelayMs: 0,
        onProgress: (p) => progressSnapshots.push(p),
        onBatchComplete: (idx, res) => batchSnapshots.push([idx, res]),
      },
      { createdCollections: 2 },
    );

    expect(created).toEqual(items.map((i) => i.url));
    expect(result.successCount).toBe(7);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.failedUrls).toEqual([]);
    expect(result.createdCollections).toBe(2);
    expect(result.duration).toBeGreaterThanOrEqual(0);

    // 3 バッチ発生（3, 3, 1）、各バッチ完了ごとに通知される
    expect(progressSnapshots).toHaveLength(3);
    expect(batchSnapshots).toHaveLength(3);
    expect(progressSnapshots[0]).toMatchObject({
      status: "importing",
      processedCount: 3,
      totalCount: 7,
      currentBatch: 1,
      totalBatches: 3,
    });
    expect(progressSnapshots[2]).toMatchObject({
      processedCount: 7,
      percentage: 100,
      currentBatch: 3,
      totalBatches: 3,
      estimatedRemainingSeconds: null,
    });

    // バッチ結果はすべて success
    for (const [, res] of batchSnapshots) {
      for (const r of res) {
        expect(r.status).toBe("success");
        expect(r.output).toBe(`ok:${r.url}`);
      }
    }
  });

  it("skips items listed in skipUrls without invoking createItem", async () => {
    const items = [
      { url: "https://a.example" },
      { url: "https://b.example" },
      { url: "https://c.example" },
    ];
    const calls: string[] = [];

    const result = await processBatches<{ url: string }, string>({
      items,
      skipUrls: new Set(["https://b.example"]),
      createItem: async (item) => {
        calls.push(item.url);
        return item.url;
      },
      batchSize: 10,
      batchDelayMs: 0,
    });

    expect(calls).toEqual(["https://a.example", "https://c.example"]);
    expect(result.successCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.failedUrls).toEqual([]);
  });

  it("continues processing when createItem throws for individual items and records failed URLs", async () => {
    const items = [
      { url: "https://ok-1.example" },
      { url: "https://fail.example" },
      { url: "https://ok-2.example" },
    ];

    const result = await processBatches<{ url: string }, string>({
      items,
      createItem: async (item) => {
        if (item.url === "https://fail.example") {
          throw new Error("boom");
        }
        return item.url;
      },
      batchSize: 10,
      batchDelayMs: 0,
    });

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.failedUrls).toEqual(["https://fail.example"]);
    expect(result.skippedCount).toBe(0);
  });

  it("stops starting new batches after AbortSignal is aborted mid-process", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/${i}`,
    }));
    const controller = new AbortController();
    const startedBatches: number[] = [];

    const result = await processBatches<{ url: string }, string>({
      items,
      createItem: async (item) => item.url,
      batchSize: 2,
      batchDelayMs: 0,
      signal: controller.signal,
      onBatchComplete: (idx) => {
        startedBatches.push(idx);
        // 最初のバッチ完了直後にキャンセルを発火
        if (idx === 0) {
          controller.abort();
        }
      },
    });

    // 1 バッチ分（2 件）のみ処理され、以降のバッチは開始されない
    expect(startedBatches).toEqual([0]);
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
  });
});
