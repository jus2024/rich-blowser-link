/**
 * ソート関連の純粋ユーティリティ関数群
 *
 * Bookmark 一覧のクライアントサイドソートを提供する。
 * 各関数は元配列を変更せず、ソート済みの新しい配列を返す。
 *
 * 設計方針:
 * - 個人利用の数百件規模を想定し、クライアントサイドで実行する
 * - DynamoDB の柔軟なソートが困難なため、全件取得後にソートする方式を採用
 */

import type { Bookmark } from "@/src/types";

/**
 * Bookmark を createdAt の降順でソートする。
 *
 * Validates: Requirements 13.2
 *
 * @param bookmarks ソート対象の Bookmark 配列
 * @returns createdAt 降順でソートされた新しい配列（元配列は変更しない）
 */
export function sortByCreatedAt(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) => {
    if (a.createdAt > b.createdAt) return -1;
    if (a.createdAt < b.createdAt) return 1;
    return 0;
  });
}

/**
 * Bookmark を lastAccessedAt の降順でソートする。
 * 未アクセス（lastAccessedAt が空文字列）の Bookmark は末尾に配置する。
 *
 * ソート順:
 * 1. lastAccessedAt が非空の Bookmark を降順で並べる
 * 2. lastAccessedAt が空の Bookmark を末尾に配置する
 *
 * Validates: Requirements 13.3
 *
 * @param bookmarks ソート対象の Bookmark 配列
 * @returns lastAccessedAt 降順（未アクセス末尾）でソートされた新しい配列（元配列は変更しない）
 */
export function sortByLastAccessedAt(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) => {
    const aEmpty = a.lastAccessedAt === "";
    const bEmpty = b.lastAccessedAt === "";

    // 両方空の場合は元の順序を維持
    if (aEmpty && bEmpty) return 0;
    // a が空なら末尾へ
    if (aEmpty) return 1;
    // b が空なら末尾へ
    if (bEmpty) return -1;

    // 両方非空の場合は降順ソート
    if (a.lastAccessedAt > b.lastAccessedAt) return -1;
    if (a.lastAccessedAt < b.lastAccessedAt) return 1;
    return 0;
  });
}

/**
 * Bookmark を accessCount の降順でソートする。
 *
 * Validates: Requirements 13.4
 *
 * @param bookmarks ソート対象の Bookmark 配列
 * @returns accessCount 降順でソートされた新しい配列（元配列は変更しない）
 */
export function sortByAccessCount(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) => b.accessCount - a.accessCount);
}

/**
 * Bookmark を sortOrder の昇順でソートする。
 *
 * Validates: Requirements 3.6
 *
 * @param bookmarks ソート対象の Bookmark 配列
 * @returns sortOrder 昇順でソートされた新しい配列（元配列は変更しない）
 */
export function sortBySortOrder(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) => a.sortOrder - b.sortOrder);
}
