/**
 * ファビコン URL 生成ユーティリティ
 *
 * Bookmark の URL からドメインを抽出し、Google Favicon API を使用して
 * ファビコン画像の URL を生成する。クライアントサイドで動的に生成し、
 * サーバーサイドでの保存は行わない。
 *
 * Validates: Requirements 9.1, 9.4
 */

/**
 * URL からドメインを抽出し、Google Favicon API のファビコン URL を返す。
 *
 * - 有効な HTTP/HTTPS URL の場合: `https://www.google.com/s2/favicons?domain={domain}&sz=32` を返す
 * - 不正な URL（パース不可能）の場合: 空文字列を返す
 *
 * @param url - ファビコンを取得したい対象の URL
 * @returns Google Favicon API の URL、または空文字列
 */
export function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    const domain = parsed.hostname;
    if (!domain) {
      return "";
    }

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}
