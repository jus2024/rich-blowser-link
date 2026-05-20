import { describe, expect, it } from "vitest";

import { getDisplayTitle, shouldShowDescription } from "./ogpUtils";

describe("getDisplayTitle", () => {
  it("returns the title when it is a non-empty string", () => {
    expect(
      getDisplayTitle({
        title: "Example Page",
        url: "https://example.com",
      }),
    ).toBe("Example Page");
  });

  it("returns the URL when the title is an empty string", () => {
    expect(
      getDisplayTitle({
        title: "",
        url: "https://example.com",
      }),
    ).toBe("https://example.com");
  });

  it("returns the URL when the title contains only whitespace", () => {
    expect(
      getDisplayTitle({
        title: "   \t\n",
        url: "https://example.com/path",
      }),
    ).toBe("https://example.com/path");
  });

  it("preserves the original title without trimming", () => {
    expect(
      getDisplayTitle({
        title: "  Title with spaces  ",
        url: "https://example.com",
      }),
    ).toBe("  Title with spaces  ");
  });
});

describe("shouldShowDescription", () => {
  it("returns true for a non-empty description", () => {
    expect(shouldShowDescription({ description: "A real description" })).toBe(
      true,
    );
  });

  it("returns false for an empty string", () => {
    expect(shouldShowDescription({ description: "" })).toBe(false);
  });

  it("returns false for whitespace-only description", () => {
    expect(shouldShowDescription({ description: "   \n\t" })).toBe(false);
  });
});
