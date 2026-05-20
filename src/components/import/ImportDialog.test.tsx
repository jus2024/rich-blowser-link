import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import type {
  DuplicateCheckResult,
  ImportProgress,
  ImportResult,
  ParseResult,
} from "@/src/lib/import/types";
import { ImportDialog } from "./ImportDialog";

// ---------------------------------------------------------------------------
// useImport のモック
// ---------------------------------------------------------------------------

const parseFileMock = vi.fn<(file: File) => Promise<ParseResult>>();
const checkDuplicatesMock =
  vi.fn<(bookmarks: ParseResult["bookmarks"]) => Promise<DuplicateCheckResult>>();
const startImportMock =
  vi.fn<(parseResult: ParseResult, strategy: string) => Promise<ImportResult>>();
const cancelImportMock = vi.fn<() => void>();

let progressState: ImportProgress = {
  status: "idle",
  processedCount: 0,
  totalCount: 0,
  percentage: 0,
  estimatedRemainingSeconds: null,
  currentBatch: 0,
  totalBatches: 0,
};

vi.mock("@/src/hooks/useImport", () => ({
  useImport: () => ({
    parseFile: parseFileMock,
    checkDuplicates: checkDuplicatesMock,
    startImport: startImportMock,
    cancelImport: cancelImportMock,
    progress: progressState,
    error: null,
  }),
}));

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

function buildParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    bookmarks: [
      { url: "https://a.example.com", title: "A", folderPath: [] },
      {
        url: "https://b.example.com",
        title: "B",
        folderPath: ["Work"],
      },
    ],
    folders: [
      { name: "Work", path: [], bookmarkCount: 1 },
    ],
    totalCount: 2,
    validCount: 2,
    skippedCount: 0,
    ...overrides,
  };
}

function buildImportResult(
  overrides: Partial<ImportResult> = {},
): ImportResult {
  return {
    successCount: 2,
    skippedCount: 0,
    failedCount: 0,
    createdCollections: 1,
    failedUrls: [],
    duration: 1234,
    ...overrides,
  };
}

function createHtmlFile(
  name = "bookmarks.html",
  size = 1024,
): File {
  const content = "a".repeat(size);
  const file = new File([content], name, { type: "text/html" });
  return file;
}

/**
 * File input に対して `files` プロパティを差し替えた上で change イベントを発火する。
 */
function fireFileInputChange(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  fireEvent.change(input);
}

beforeEach(() => {
  parseFileMock.mockReset();
  checkDuplicatesMock.mockReset();
  startImportMock.mockReset();
  cancelImportMock.mockReset();
  progressState = {
    status: "idle",
    processedCount: 0,
    totalCount: 0,
    percentage: 0,
    estimatedRemainingSeconds: null,
    currentBatch: 0,
    totalBatches: 0,
  };
});

describe("ImportDialog", () => {
  it("isOpen=false のときは何も描画しない", () => {
    const { container } = render(
      <ImportDialog isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("isOpen=true のときはファイル選択ビューを表示する（Requirement 10.1）", () => {
    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: /Chrome ブックマークインポート/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ここにファイルをドラッグ&ドロップ/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ファイルを選択/),
    ).toBeInTheDocument();
  });

  it(".html 以外のファイルはエラー表示する（Requirement 10.2）", () => {
    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const nonHtml = new File(["x"], "bookmarks.json", {
      type: "application/json",
    });
    fireFileInputChange(input, nonHtml);

    expect(
      screen.getByText(/HTML ファイル \(\.html\)/),
    ).toBeInTheDocument();
    expect(parseFileMock).not.toHaveBeenCalled();
  });

  it("10MB を超えるファイルはエラー表示する（Requirement 10.1）", () => {
    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    // File.size を直接差し替えて 11MB に見せかける（実データは作らない）
    const huge = new File(["x"], "big.html", { type: "text/html" });
    Object.defineProperty(huge, "size", {
      configurable: true,
      value: 11 * 1024 * 1024,
    });
    fireFileInputChange(input, huge);

    expect(
      screen.getByText(/ファイルサイズが上限 \(10MB\) を超えています/),
    ).toBeInTheDocument();
    expect(parseFileMock).not.toHaveBeenCalled();
  });

  it("パース成功時はプレビュー（件数 + フォルダ）を表示する（Requirement 10.1）", async () => {
    parseFileMock.mockResolvedValue(buildParseResult());

    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    fireFileInputChange(input, createHtmlFile());

    await waitFor(() => {
      expect(screen.getByText("インポート対象")).toBeInTheDocument();
    });

    expect(parseFileMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("フォルダ構造")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "インポート開始" }),
    ).toBeEnabled();
  });

  it("パース失敗時はエラーを表示して fileSelect に戻る（Requirement 10.2）", async () => {
    parseFileMock.mockRejectedValue(
      new Error("DOCTYPE NETSCAPE ヘッダーが見つかりません"),
    );

    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    fireFileInputChange(input, createHtmlFile());

    await waitFor(() => {
      expect(
        screen.getByText(/DOCTYPE NETSCAPE ヘッダーが見つかりません/),
      ).toBeInTheDocument();
    });

    // fileSelect に戻っているので、ドロップゾーンが引き続き表示されている
    expect(
      screen.getByText(/ここにファイルをドラッグ&ドロップ/),
    ).toBeInTheDocument();
  });

  it("重複 0 件のときは DuplicateChoice をスキップして直接インポートを開始する（Requirement 10.7）", async () => {
    parseFileMock.mockResolvedValue(buildParseResult());
    checkDuplicatesMock.mockResolvedValue({
      duplicateUrls: [],
      duplicateCount: 0,
      newCount: 2,
    });
    startImportMock.mockResolvedValue(buildImportResult());

    const onImportComplete = vi.fn();
    render(
      <ImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={onImportComplete}
      />,
    );

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;
    fireFileInputChange(input, createHtmlFile());

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "インポート開始" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "インポート開始" }));

    await waitFor(() => {
      expect(screen.getByText("インポート完了")).toBeInTheDocument();
    });

    expect(checkDuplicatesMock).toHaveBeenCalledTimes(1);
    // DuplicateChoice は通らない（重複ゼロなので "続行" ボタンは現れない）
    expect(startImportMock).toHaveBeenCalledWith(
      expect.anything(),
      "skip",
      "folder-inherit",
    );
    expect(onImportComplete).toHaveBeenCalledTimes(1);
  });

  it("重複ありのとき DuplicateChoice を表示し、merge を選んで続行するとその戦略で startImport を呼ぶ（Requirement 10.9）", async () => {
    parseFileMock.mockResolvedValue(buildParseResult());
    checkDuplicatesMock.mockResolvedValue({
      duplicateUrls: ["https://a.example.com"],
      duplicateCount: 1,
      newCount: 1,
    });
    startImportMock.mockResolvedValue(buildImportResult());

    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;
    fireFileInputChange(input, createHtmlFile());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "インポート開始" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "インポート開始" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "続行" }),
      ).toBeInTheDocument();
    });

    // 「1 件」は重複件数と新規件数の両方に出現するので getAllByText で確認する。
    expect(screen.getAllByText(/1 件/).length).toBeGreaterThanOrEqual(2);

    // デフォルトは skip。merge に切り替える。
    const mergeRadio = screen.getByRole("radio", { name: /マージ/ });
    fireEvent.click(mergeRadio);
    expect(mergeRadio).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "続行" }));

    await waitFor(() => {
      expect(startImportMock).toHaveBeenCalledWith(expect.anything(), "merge", "folder-inherit");
    });

    await waitFor(() =>
      expect(screen.getByText("インポート完了")).toBeInTheDocument(),
    );
  });

  it("重複ありで skip を選択した場合 skip 戦略で startImport を呼ぶ（Requirement 10.8）", async () => {
    parseFileMock.mockResolvedValue(buildParseResult());
    checkDuplicatesMock.mockResolvedValue({
      duplicateUrls: ["https://a.example.com"],
      duplicateCount: 1,
      newCount: 1,
    });
    startImportMock.mockResolvedValue(buildImportResult());

    render(<ImportDialog isOpen={true} onClose={vi.fn()} />);

    const input = screen
      .getByText("ファイルを選択")
      .closest("label")
      ?.querySelector('input[type="file"]') as HTMLInputElement;
    fireFileInputChange(input, createHtmlFile());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "インポート開始" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "インポート開始" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "続行" })).toBeInTheDocument(),
    );

    // デフォルトが skip なのでそのまま続行
    expect(screen.getByRole("radio", { name: /スキップ/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "続行" }));

    await waitFor(() =>
      expect(startImportMock).toHaveBeenCalledWith(expect.anything(), "skip", "folder-inherit"),
    );
  });

  it("閉じるボタンで onClose を呼び、状態を初期化する", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ImportDialog isOpen={true} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // 再度開き直したときに fileSelect ビューに戻っていることを確認
    act(() => {
      rerender(<ImportDialog isOpen={false} onClose={onClose} />);
    });
    act(() => {
      rerender(<ImportDialog isOpen={true} onClose={onClose} />);
    });
    expect(
      screen.getByText(/ここにファイルをドラッグ&ドロップ/),
    ).toBeInTheDocument();
  });

  it("ドラッグ&ドロップでファイル投入した場合も parseFile が呼ばれる", async () => {
    parseFileMock.mockResolvedValue(buildParseResult());

    const { container } = render(
      <ImportDialog isOpen={true} onClose={vi.fn()} />,
    );

    // 最初の div の中からドロップゾーンを探す（onDrop ハンドラを持つ要素）
    const dropZone = container.querySelector(
      "[class*='dropZone']",
    ) as HTMLElement;
    expect(dropZone).toBeTruthy();

    const file = createHtmlFile();
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(parseFileMock).toHaveBeenCalledTimes(1);
    });
  });
});
