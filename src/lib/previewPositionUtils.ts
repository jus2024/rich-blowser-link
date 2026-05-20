/**
 * OGPPreviewCard のビューポート境界を考慮したポジショニングユーティリティ。
 *
 * Requirements 4.6: プレビューカードがビューポートからはみ出さないように位置を計算する。
 */

/** プレビューカードとカーソルの間のギャップ（px） */
const GAP = 12;

/**
 * OGPPreviewCard の表示位置をマウス座標を基準に計算する。
 * ビューポートからはみ出す場合は反対側に表示する。
 *
 * @param mouseX - マウスの clientX 座標
 * @param mouseY - マウスの clientY 座標
 * @param previewSize - プレビューカードの想定サイズ
 * @param viewport - ビューポートサイズ
 * @returns CSS の top/left 値
 */
export function calculatePreviewPositionFromMouse(
  mouseX: number,
  mouseY: number,
  previewSize: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  // デフォルト: カーソルの右下に表示
  let left = mouseX + GAP;
  let top = mouseY + GAP;

  // 右側にはみ出す場合はカーソルの左側に表示
  if (left + previewSize.width > viewport.width) {
    left = mouseX - previewSize.width - GAP;
  }

  // 左側にもはみ出す場合は左端に合わせる
  if (left < 0) {
    left = GAP;
  }

  // 下側にはみ出す場合はカーソルの上側に表示
  if (top + previewSize.height > viewport.height) {
    top = mouseY - previewSize.height - GAP;
  }

  // 上側にもはみ出す場合は上端に合わせる
  if (top < 0) {
    top = GAP;
  }

  return { top, left };
}

/**
 * OGPPreviewCard の表示位置を計算する（カード基準、後方互換）。
 * カードがビューポートからはみ出す場合は反対側に表示する。
 *
 * デフォルト位置: カードの右側
 * - 右側にはみ出す場合: 左側に表示
 * - 下側にはみ出す場合: top を上方向に調整
 *
 * @param cardRect - BookmarkCard の DOMRect
 * @param previewSize - プレビューカードの想定サイズ
 * @param viewport - ビューポートサイズ
 * @returns CSS の top/left 値
 */
export function calculatePreviewPosition(
  cardRect: DOMRect,
  previewSize: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  // デフォルト: カードの右側に表示
  let left = cardRect.right + GAP;
  let top = cardRect.top;

  // 右側にはみ出す場合は左側に表示
  if (left + previewSize.width > viewport.width) {
    left = cardRect.left - previewSize.width - GAP;
  }

  // 左側にもはみ出す場合はカードの左端に合わせる
  if (left < 0) {
    left = GAP;
  }

  // 下側にはみ出す場合は top を上方向に調整
  if (top + previewSize.height > viewport.height) {
    top = viewport.height - previewSize.height - GAP;
  }

  // 上側にもはみ出す場合は上端に合わせる
  if (top < 0) {
    top = GAP;
  }

  return { top, left };
}
