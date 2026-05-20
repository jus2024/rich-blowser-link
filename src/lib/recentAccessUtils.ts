/**
 * ブックマークが最近アクセスされたかを判定する。
 *
 * @param lastAccessedAt - ISO 8601 形式の最終アクセス日時（空文字 = 未アクセス）
 * @param now - 現在時刻（テスト容易性のため注入可能）
 * @returns 24 時間以内にアクセスされた場合 true
 */
export function isRecentlyAccessed(
  lastAccessedAt: string,
  now?: Date,
): boolean {
  if (!lastAccessedAt) return false;
  const accessedTime = new Date(lastAccessedAt).getTime();
  const currentTime = (now ?? new Date()).getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return currentTime - accessedTime < TWENTY_FOUR_HOURS_MS;
}
