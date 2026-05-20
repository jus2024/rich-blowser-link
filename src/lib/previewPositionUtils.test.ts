import { describe, it, expect } from "vitest";
import { calculatePreviewPosition } from "./previewPositionUtils";

/**
 * `calculatePreviewPosition` のテスト。
 *
 * Requirements 4.6: プレビューカードがビューポート境界を越えないようにする。
 *
 * デフォルトはカード右側に表示し、右側に入りきらない場合は左側にフリップする。
 * 縦方向も同様にビューポート下端/上端を越える場合はクランプする。
 */

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    bottom: y + height,
    left: x,
    right: x + width,
    toJSON: () => ({}),
  } as DOMRect;
}

const PREVIEW = { width: 360, height: 240 };
const VIEWPORT = { width: 1280, height: 800 };

describe("calculatePreviewPosition", () => {
  it("カードが画面左寄りにある場合は右側に表示する", () => {
    const cardRect = rect(100, 200, 300, 100);
    const { top, left } = calculatePreviewPosition(
      cardRect,
      PREVIEW,
      VIEWPORT,
    );
    expect(left).toBe(cardRect.right + 12);
    expect(top).toBe(cardRect.top);
  });

  it("右側にはみ出す場合は左側に表示する", () => {
    // カード右端を画面右端近くに配置 → 右側に 360+8 px 分の余白がない
    const cardRect = rect(1000, 200, 250, 100);
    const { left } = calculatePreviewPosition(cardRect, PREVIEW, VIEWPORT);
    expect(left).toBe(cardRect.left - PREVIEW.width - 12);
  });

  it("左右どちらにもはみ出す狭い画面ではギャップ位置にクランプする", () => {
    const narrow = { width: 300, height: 800 };
    const cardRect = rect(10, 100, 250, 100);
    const { left } = calculatePreviewPosition(cardRect, PREVIEW, narrow);
    // 右に置いても左に置いてもはみ出す → left = GAP(12)
    expect(left).toBe(12);
  });

  it("下側にはみ出す場合は top をビューポート内に収める", () => {
    const cardRect = rect(100, 700, 300, 100);
    const { top } = calculatePreviewPosition(cardRect, PREVIEW, VIEWPORT);
    expect(top).toBe(VIEWPORT.height - PREVIEW.height - 12);
    expect(top + PREVIEW.height + 12).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it("上側にはみ出すほど画面が小さい場合は top をギャップ位置にクランプする", () => {
    const tiny = { width: 1280, height: 200 };
    const cardRect = rect(100, 10, 300, 50);
    const { top } = calculatePreviewPosition(cardRect, PREVIEW, tiny);
    expect(top).toBe(12);
  });

  it("計算結果は常にビューポート矩形内に収まる", () => {
    const cardRect = rect(600, 400, 300, 100);
    const { top, left } = calculatePreviewPosition(
      cardRect,
      PREVIEW,
      VIEWPORT,
    );
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + PREVIEW.width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(top + PREVIEW.height).toBeLessThanOrEqual(VIEWPORT.height);
  });
});
