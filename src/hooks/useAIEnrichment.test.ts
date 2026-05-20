import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAIEnrichment } from "./useAIEnrichment";

describe("useAIEnrichment", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("デフォルト値は true（ON）", () => {
    const { result } = renderHook(() => useAIEnrichment());
    expect(result.current.isAIEnabled).toBe(true);
  });

  it("setAIEnabled(false) で状態が false に変わる", () => {
    const { result } = renderHook(() => useAIEnrichment());

    act(() => {
      result.current.setAIEnabled(false);
    });

    expect(result.current.isAIEnabled).toBe(false);
  });

  it("setAIEnabled で localStorage に即座に書き込む", () => {
    const { result } = renderHook(() => useAIEnrichment());

    act(() => {
      result.current.setAIEnabled(false);
    });

    expect(localStorage.getItem("ai-enrichment-enabled")).toBe("false");
  });

  it("localStorage に保存された値を復元する（false）", () => {
    localStorage.setItem("ai-enrichment-enabled", "false");

    const { result } = renderHook(() => useAIEnrichment());

    expect(result.current.isAIEnabled).toBe(false);
  });

  it("localStorage に保存された値を復元する（true）", () => {
    localStorage.setItem("ai-enrichment-enabled", "true");

    const { result } = renderHook(() => useAIEnrichment());

    expect(result.current.isAIEnabled).toBe(true);
  });

  it("localStorage に無効な値がある場合はデフォルト値（true）を使用する", () => {
    localStorage.setItem("ai-enrichment-enabled", "invalid");

    const { result } = renderHook(() => useAIEnrichment());

    // "invalid" !== "true" なので false になる
    expect(result.current.isAIEnabled).toBe(false);
  });

  it("setAIEnabled(true) で状態を true に戻せる", () => {
    const { result } = renderHook(() => useAIEnrichment());

    act(() => {
      result.current.setAIEnabled(false);
    });
    expect(result.current.isAIEnabled).toBe(false);

    act(() => {
      result.current.setAIEnabled(true);
    });
    expect(result.current.isAIEnabled).toBe(true);
    expect(localStorage.getItem("ai-enrichment-enabled")).toBe("true");
  });
});
