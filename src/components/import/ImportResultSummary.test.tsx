import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImportResultSummary } from "./ImportResultSummary";
import type { ImportResult } from "@/src/lib/import/types";

/**
 * ImportResultSummary の単体テスト。
 *
 * Validates Requirements: 10.11, 10.12
 */
describe("ImportResultSummary", () => {
  const baseResult = (overrides: Partial<ImportResult> = {}): ImportResult => ({
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    createdCollections: 0,
    failedUrls: [],
    duration: 0,
    ...overrides,
  });

  it("全件数と作成 Collection 数、処理時間を表示する（Requirement 10.12）", () => {
    render(
      <ImportResultSummary
        result={baseResult({
          successCount: 120,
          skippedCount: 5,
          failedCount: 2,
          createdCollections: 3,
          duration: 4500,
        })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("インポート完了")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4.5秒")).toBeInTheDocument();
  });

  it("失敗 URL が無い場合は失敗リストセクションを表示しない", () => {
    render(
      <ImportResultSummary
        result={baseResult({ successCount: 10 })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText(/失敗した URL/)).not.toBeInTheDocument();
  });

  it("失敗 URL がある場合は件数と URL 一覧を表示する（Requirement 10.11）", () => {
    const failedUrls = [
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ];

    render(
      <ImportResultSummary
        result={baseResult({
          failedCount: failedUrls.length,
          failedUrls,
        })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/失敗した URL \(3件\)/)).toBeInTheDocument();
    for (const url of failedUrls) {
      expect(screen.getByText(url)).toBeInTheDocument();
    }
  });

  it("閉じるボタンを押すと onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(
      <ImportResultSummary result={baseResult()} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("duration が 0 でも表示崩れせず '0.0秒' と表示する", () => {
    render(
      <ImportResultSummary
        result={baseResult({ duration: 0 })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("0.0秒")).toBeInTheDocument();
  });
});
