import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CollectionForm } from "./CollectionForm";
import type { Collection } from "@/src/types";

/**
 * CollectionForm の単体テスト。
 *
 * Validates Requirements: 5.1, 5.6, 5.8
 */
describe("CollectionForm", () => {
  const makeCollection = (overrides: Partial<Collection> = {}): Collection => ({
    id: "col-1",
    name: "既存コレクション",
    description: "既存の説明",
    parentId: null,
    owner: "user-1",
    ...overrides,
  });

  it("新規作成モードでは送信ボタンが初期状態で無効", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />);

    const submitButton = screen.getByRole("button", { name: "作成" });
    expect(submitButton).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("有効な名前を入力すると送信ボタンが有効になり、onSubmit が呼ばれる", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />);

    const nameInput = screen.getByLabelText(/名前/);
    fireEvent.change(nameInput, { target: { value: "あとで読む" } });

    const submitButton = screen.getByRole("button", { name: "作成" });
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      name: "あとで読む",
      description: "",
      parentId: null,
    });
  });

  it("名前が 100 文字を超えるとインラインエラーが表示され、送信ボタンが無効", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />);

    const nameInput = screen.getByLabelText(/名前/);
    fireEvent.change(nameInput, { target: { value: "a".repeat(101) } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /100 文字以内で入力してください/,
    );
    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("説明が 500 文字を超えるとインラインエラーが表示され、送信ボタンが無効", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />);

    const nameInput = screen.getByLabelText(/名前/);
    fireEvent.change(nameInput, { target: { value: "有効な名前" } });

    const descInput = screen.getByLabelText("説明");
    fireEvent.change(descInput, { target: { value: "a".repeat(501) } });

    expect(
      screen.getByText(/500 文字以内で入力してください/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("キャンセルボタンを押すと onCancel が呼ばれる", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("編集モードでは既存値がプレフィルされ、ボタンラベルが「更新」になる", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(
      <CollectionForm
        collection={makeCollection()}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText(/名前/)).toHaveValue("既存コレクション");
    expect(screen.getByLabelText("説明")).toHaveValue("既存の説明");
    expect(screen.getByRole("button", { name: "更新" })).toBeEnabled();
  });

  it("onSubmit が reject するとエラーバナーが表示される（Requirement 5.8: 名前重複を親が throw）", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error("同じ名前の Collection が既に存在します"));
    const onCancel = vi.fn();

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText(/名前/), {
      target: { value: "重複する名前" },
    });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        screen.getByText("同じ名前の Collection が既に存在します"),
      ).toBeInTheDocument();
    });

    // エラー後もフォームは操作可能（ボタンが再度有効）
    expect(screen.getByRole("button", { name: "作成" })).toBeEnabled();
  });
});
