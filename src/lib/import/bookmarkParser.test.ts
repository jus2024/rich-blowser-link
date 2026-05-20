import { describe, expect, it } from "vitest";

import {
  InvalidFormatError,
  parseNetscapeBookmarkFile,
} from "./bookmarkParser";

const HEADER = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>`;

describe("parseNetscapeBookmarkFile", () => {
  it("parses a file with one folder and one bookmark", () => {
    const html = `${HEADER}
<DL><p>
    <DT><H3>News</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1700000000">Example Site</A>
    </DL><p>
</DL><p>`;

    const result = parseNetscapeBookmarkFile(html);

    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0]).toEqual({
      url: "https://example.com",
      title: "Example Site",
      addDate: 1700000000,
      folderPath: ["News"],
    });

    expect(result.folders).toHaveLength(1);
    expect(result.folders[0]).toEqual({
      name: "News",
      path: ["News"],
      bookmarkCount: 1,
    });

    expect(result.totalCount).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it("throws InvalidFormatError when the DOCTYPE header is missing", () => {
    const html = `<html><body><DL><DT><A HREF="https://example.com">x</A></DL></body></html>`;

    expect(() => parseNetscapeBookmarkFile(html)).toThrow(InvalidFormatError);
  });

  it("throws InvalidFormatError for an empty string", () => {
    expect(() => parseNetscapeBookmarkFile("")).toThrow(InvalidFormatError);
  });

  it("produces correct folderPath arrays for nested folders", () => {
    const html = `${HEADER}
<DL><p>
    <DT><H3>Parent</H3>
    <DL><p>
        <DT><A HREF="https://parent.example.com">Parent Link</A>
        <DT><H3>Child</H3>
        <DL><p>
            <DT><A HREF="https://child.example.com">Child Link</A>
            <DT><H3>Grandchild</H3>
            <DL><p>
                <DT><A HREF="https://grandchild.example.com">Grandchild Link</A>
            </DL><p>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://root.example.com">Root Link</A>
</DL><p>`;

    const result = parseNetscapeBookmarkFile(html);

    expect(result.bookmarks).toHaveLength(4);

    const byUrl = new Map(result.bookmarks.map((b) => [b.url, b]));
    expect(byUrl.get("https://root.example.com")?.folderPath).toEqual([]);
    expect(byUrl.get("https://parent.example.com")?.folderPath).toEqual([
      "Parent",
    ]);
    expect(byUrl.get("https://child.example.com")?.folderPath).toEqual([
      "Parent",
      "Child",
    ]);
    expect(byUrl.get("https://grandchild.example.com")?.folderPath).toEqual([
      "Parent",
      "Child",
      "Grandchild",
    ]);

    const folderPaths = result.folders.map((f) => f.path);
    expect(folderPaths).toContainEqual(["Parent"]);
    expect(folderPaths).toContainEqual(["Parent", "Child"]);
    expect(folderPaths).toContainEqual(["Parent", "Child", "Grandchild"]);
  });

  it("includes non-http entries in bookmarks (filtering is done in a later step)", () => {
    const html = `${HEADER}
<DL><p>
    <DT><A HREF="javascript:void(0)">JS</A>
    <DT><A HREF="https://example.com">OK</A>
</DL><p>`;

    const result = parseNetscapeBookmarkFile(html);

    expect(result.bookmarks).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.skippedCount).toBe(0);
  });

  it("omits addDate when the ADD_DATE attribute is absent", () => {
    const html = `${HEADER}
<DL><p>
    <DT><A HREF="https://example.com">Example</A>
</DL><p>`;

    const result = parseNetscapeBookmarkFile(html);

    expect(result.bookmarks[0].addDate).toBeUndefined();
  });
});

import { buildCollectionName, filterValidBookmarks } from "./bookmarkParser";
import type { ParsedBookmark } from "./types";

const makeBookmark = (
  url: string,
  overrides: Partial<ParsedBookmark> = {},
): ParsedBookmark => ({
  url,
  title: overrides.title ?? "title",
  folderPath: overrides.folderPath ?? [],
  ...(overrides.addDate !== undefined ? { addDate: overrides.addDate } : {}),
});

describe("filterValidBookmarks", () => {
  it("accepts http and https URLs as valid", () => {
    const input = [
      makeBookmark("http://example.com"),
      makeBookmark("https://example.com/path"),
    ];

    const { valid, skipped } = filterValidBookmarks(input);

    expect(valid).toEqual(input);
    expect(skipped).toEqual([]);
  });

  it("rejects non-http(s) schemes", () => {
    const input = [
      makeBookmark("javascript:void(0)"),
      makeBookmark("ftp://example.com"),
      makeBookmark("file:///tmp/a.txt"),
      makeBookmark("mailto:user@example.com"),
      makeBookmark("chrome://bookmarks/"),
    ];

    const { valid, skipped } = filterValidBookmarks(input);

    expect(valid).toEqual([]);
    expect(skipped).toEqual(input);
  });

  it("rejects strings that cannot be parsed as URLs", () => {
    const input = [
      makeBookmark(""),
      makeBookmark("not a url"),
      makeBookmark("://missing-scheme"),
    ];

    const { valid, skipped } = filterValidBookmarks(input);

    expect(valid).toEqual([]);
    expect(skipped).toEqual(input);
  });

  it("preserves input order within both valid and skipped arrays", () => {
    const input = [
      makeBookmark("https://a.example", { title: "A" }),
      makeBookmark("javascript:0", { title: "B" }),
      makeBookmark("http://c.example", { title: "C" }),
      makeBookmark("ftp://d.example", { title: "D" }),
      makeBookmark("https://e.example", { title: "E" }),
    ];

    const { valid, skipped } = filterValidBookmarks(input);

    expect(valid.map((b) => b.title)).toEqual(["A", "C", "E"]);
    expect(skipped.map((b) => b.title)).toEqual(["B", "D"]);
    expect(valid.length + skipped.length).toBe(input.length);
  });

  it("returns empty arrays for empty input", () => {
    const { valid, skipped } = filterValidBookmarks([]);
    expect(valid).toEqual([]);
    expect(skipped).toEqual([]);
  });
});

describe("buildCollectionName", () => {
  it("returns an empty string for an empty folder path", () => {
    expect(buildCollectionName([])).toBe("");
  });

  it("returns the single element as-is", () => {
    expect(buildCollectionName(["News"])).toBe("News");
  });

  it("joins multiple elements with '/'", () => {
    expect(buildCollectionName(["Parent", "Child", "Grandchild"])).toBe(
      "Parent/Child/Grandchild",
    );
  });

  it("truncates results longer than 100 characters to exactly 100 characters", () => {
    const longSegment = "a".repeat(60);
    const input = [longSegment, longSegment];
    const result = buildCollectionName(input);

    expect(result.length).toBe(100);
    // join は "a".repeat(60) + "/" + "a".repeat(60) = 121 文字なので先頭 100 文字
    expect(result).toBe("a".repeat(60) + "/" + "a".repeat(39));
  });

  it("does not truncate when the joined length is exactly 100 characters", () => {
    const input = ["a".repeat(49), "a".repeat(50)]; // 49 + 1 + 50 = 100
    const result = buildCollectionName(input);

    expect(result.length).toBe(100);
    expect(result).toBe("a".repeat(49) + "/" + "a".repeat(50));
  });

  it("preserves non-ASCII characters before truncation", () => {
    expect(buildCollectionName(["親", "子"])).toBe("親/子");
  });
});
