/**
 * sortOrder 再計算ユーティリティ
 *
 * ブックマークの並び替え時に sortOrder を再計算する。
 * 隣接する要素の中間値を使用し、衝突時のみ全体を再番号付けする。
 *
 * Validates: Requirements 3.3
 */

import type { Bookmark } from "@/src/types";

/** 再番号付け時の等間隔 */
const RENUMBER_INTERVAL = 1000;

/**
 * ブックマークを新しい位置に移動した際の sortOrder を計算する。
 *
 * 戦略:
 * 1. 移動先の前後の sortOrder の中間値を使用
 * 2. 中間値が整数にならない場合や衝突する場合は、全体を等間隔で再番号付け
 *
 * @param bookmarks - 現在の並び順のブックマーク配列（sortOrder 昇順）
 * @param fromIndex - 移動元のインデックス
 * @param toIndex - 移動先のインデックス
 * @returns 更新が必要な { id, sortOrder } の配列
 */
export function calculateNewSortOrders(
  bookmarks: Bookmark[],
  fromIndex: number,
  toIndex: number,
): Array<{ id: string; sortOrder: number }> {
  // 同じ位置への移動は何もしない
  if (fromIndex === toIndex) {
    return [];
  }

  // 範囲外チェック
  if (
    fromIndex < 0 ||
    fromIndex >= bookmarks.length ||
    toIndex < 0 ||
    toIndex >= bookmarks.length
  ) {
    return [];
  }

  // 移動後の配列を構築（fromIndex の要素を取り出して toIndex に挿入）
  const reordered = [...bookmarks];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  // 移動先の前後の sortOrder から中間値を計算
  const midpoint = calculateMidpoint(reordered, toIndex);

  // 中間値が整数で、かつ既存の sortOrder と衝突しない場合はそれを使用
  if (midpoint !== null && Number.isInteger(midpoint) && !hasCollision(reordered, toIndex, midpoint)) {
    if (midpoint === moved.sortOrder) {
      return [];
    }
    return [{ id: moved.id, sortOrder: midpoint }];
  }

  // 衝突または非整数の場合は全体を再番号付け
  return renumberAll(reordered);
}

/**
 * 移動先インデックスの前後の sortOrder から中間値を計算する。
 *
 * @param reordered - 並び替え後の配列
 * @param index - 移動先のインデックス
 * @returns 中間値（計算不能な場合は null）
 */
function calculateMidpoint(reordered: Bookmark[], index: number): number | null {
  const prev = index > 0 ? reordered[index - 1].sortOrder : null;
  const next = index < reordered.length - 1 ? reordered[index + 1].sortOrder : null;

  if (prev !== null && next !== null) {
    // 前後が存在する場合: 中間値
    return Math.floor((prev + next) / 2);
  } else if (prev !== null) {
    // 末尾に移動: 前の要素 + RENUMBER_INTERVAL
    return prev + RENUMBER_INTERVAL;
  } else if (next !== null) {
    // 先頭に移動: 次の要素 - RENUMBER_INTERVAL
    return next - RENUMBER_INTERVAL;
  }

  // 要素が 1 つだけの場合
  return null;
}

/**
 * 計算した sortOrder が隣接要素と衝突するかチェックする。
 * 衝突 = 前後の要素と同じ値、または順序が崩れる場合。
 */
function hasCollision(reordered: Bookmark[], index: number, value: number): boolean {
  const prev = index > 0 ? reordered[index - 1].sortOrder : null;
  const next = index < reordered.length - 1 ? reordered[index + 1].sortOrder : null;

  // 前の要素以下になる場合は衝突
  if (prev !== null && value <= prev) {
    return true;
  }

  // 次の要素以上になる場合は衝突
  if (next !== null && value >= next) {
    return true;
  }

  return false;
}

/**
 * 全要素を等間隔で再番号付けする。
 * sortOrder が変更された要素のみを返す。
 */
function renumberAll(
  reordered: Bookmark[],
): Array<{ id: string; sortOrder: number }> {
  const updates: Array<{ id: string; sortOrder: number }> = [];

  for (let i = 0; i < reordered.length; i++) {
    const newSortOrder = i * RENUMBER_INTERVAL;
    if (reordered[i].sortOrder !== newSortOrder) {
      updates.push({ id: reordered[i].id, sortOrder: newSortOrder });
    }
  }

  return updates;
}
