import { describe, expect, it } from "vitest";
import fc from "fast-check";

describe("test framework smoke", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("runs a fast-check property", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => n + 0 === n),
      { numRuns: 50 }
    );
  });
});
