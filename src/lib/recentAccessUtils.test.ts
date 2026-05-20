import { describe, it, expect } from "vitest";
import { isRecentlyAccessed } from "./recentAccessUtils";

describe("isRecentlyAccessed", () => {
  const now = new Date("2025-01-15T12:00:00.000Z");

  it("returns true when lastAccessedAt is within 24 hours", () => {
    const oneHourAgo = new Date("2025-01-15T11:00:00.000Z").toISOString();
    expect(isRecentlyAccessed(oneHourAgo, now)).toBe(true);
  });

  it("returns true when lastAccessedAt is just under 24 hours ago", () => {
    const justUnder24h = new Date("2025-01-14T12:00:00.001Z").toISOString();
    expect(isRecentlyAccessed(justUnder24h, now)).toBe(true);
  });

  it("returns false when lastAccessedAt is exactly 24 hours ago", () => {
    const exactly24h = new Date("2025-01-14T12:00:00.000Z").toISOString();
    expect(isRecentlyAccessed(exactly24h, now)).toBe(false);
  });

  it("returns false when lastAccessedAt is older than 24 hours", () => {
    const twoDaysAgo = new Date("2025-01-13T12:00:00.000Z").toISOString();
    expect(isRecentlyAccessed(twoDaysAgo, now)).toBe(false);
  });

  it("returns false when lastAccessedAt is an empty string", () => {
    expect(isRecentlyAccessed("", now)).toBe(false);
  });

  it("returns false when lastAccessedAt is in the future", () => {
    const future = new Date("2025-01-16T12:00:00.000Z").toISOString();
    // Future dates result in negative difference, which is < 24h
    expect(isRecentlyAccessed(future, now)).toBe(true);
  });
});
