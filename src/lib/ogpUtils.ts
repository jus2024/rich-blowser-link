/**
 * OGP ユーティリティ
 *
 * Bookmark の OGP メタデータ（タイトル、説明）が欠落している場合の
 * フォールバック表示ロジックと、バックグラウンドでの OGP 取得機能を提供する。
 *
 * - getDisplayTitle / shouldShowDescription: 純粋関数（副作用なし）
 * - fetchOGPInBackground: エージェント経由で OGP を非同期取得
 */

import type { Bookmark, OGPData } from "@/src/types";
import { fetchAuthSession } from "aws-amplify/auth";
import { invokeRuntime } from "@/src/lib/agent/agentRuntime";

/**
 * Bookmark 表示用のタイトルを返す。
 *
 * 判定ルール:
 * - `title` が非空文字列（前後の空白をトリム後に 1 文字以上）の場合はそのまま返す
 * - それ以外（空文字列、空白のみ、型が文字列でない）の場合は `url` を返す
 *
 * OGP タイトルが取得できなかった Bookmark でも URL 自体を識別子として
 * 表示できるようにするためのフォールバック。
 *
 * Validates: Requirements 7.5
 */
export function getDisplayTitle(
  bookmark: Pick<Bookmark, "title" | "url">,
): string {
  if (typeof bookmark.title === "string" && bookmark.title.trim().length > 0) {
    return bookmark.title;
  }

  return bookmark.url;
}

/**
 * Bookmark の説明欄を表示すべきかを返す。
 *
 * 判定ルール:
 * - `description` が文字列型で、前後の空白をトリム後に 1 文字以上ある場合のみ true
 * - それ以外（空文字列、空白のみ、型が文字列でない）は false
 *
 * 説明文が欠落している Bookmark では説明欄そのものを非表示にするための
 * 判定関数。UI 側で条件付きレンダリングに使用する想定。
 *
 * Validates: Requirements 7.5
 */
export function shouldShowDescription(
  bookmark: Pick<Bookmark, "description">,
): boolean {
  return (
    typeof bookmark.description === "string" &&
    bookmark.description.trim().length > 0
  );
}


// ---------------------------------------------------------------------------
// OGP バックグラウンド取得
// ---------------------------------------------------------------------------

/**
 * fetchOGPInBackground のオプション
 */
export interface OGPBackgroundFetchOptions {
  /** OGP を取得する対象の Bookmark ID 一覧 */
  bookmarkIds: string[];
  /** 同時実行数の上限（デフォルト 3） */
  concurrency?: number;
  /** 各 Bookmark の OGP 取得完了時に呼ばれるコールバック */
  onFetched: (bookmarkId: string, ogpData: OGPData) => void;
  /** キャンセル用の AbortSignal（ページ離脱時など） */
  signal: AbortSignal;
  /** AgentCore Runtime ARN（未指定時は環境変数から取得） */
  runtimeArn?: string;
  /**
   * 各 Bookmark の URL を取得する関数。
   * bookmarkId から URL を解決するために必要。
   */
  getBookmarkUrl: (bookmarkId: string) => string | undefined;
}

/**
 * セマフォ: 同時実行数を制限するためのユーティリティ。
 * Promise ベースで acquire/release を管理する。
 */
class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

/**
 * エージェントの OGP Fetcher ツールを呼び出し、レスポンスから OGP データをパースする。
 *
 * エージェントに「この URL の OGP 情報を取得して」というプロンプトを送り、
 * レスポンスの JSON 部分から title, description, imageUrl を抽出する。
 */
async function fetchSingleOGP(params: {
  url: string;
  runtimeArn: string;
  accessToken: string;
  signal: AbortSignal;
}): Promise<OGPData | null> {
  const { url, runtimeArn, accessToken, signal } = params;

  let responseText = "";

  return new Promise<OGPData | null>((resolve) => {
    invokeRuntime({
      runtimeArn,
      accessToken,
      sessionId: crypto.randomUUID(),
      prompt: `Fetch OGP metadata for this URL: ${url}`,
      signal,
      onChunk: (chunk: string) => {
        responseText += chunk;
      },
      onError: () => {
        resolve(null);
      },
      onComplete: () => {
        const ogpData = parseOGPResponse(responseText);
        resolve(ogpData);
      },
    });
  });
}

/**
 * エージェントのレスポンステキストから OGP データを抽出する。
 *
 * エージェントは JSON 形式で OGP データを返すことを期待するが、
 * テキスト内に埋め込まれた JSON を探索して抽出する。
 */
function parseOGPResponse(responseText: string): OGPData | null {
  if (!responseText.trim()) {
    return null;
  }

  // JSON ブロックを探す（```json ... ``` または { ... } 形式）
  const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)```/);
  const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : responseText.trim();

  // JSON オブジェクトを抽出
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const title = typeof parsed.title === "string" ? parsed.title.slice(0, 200) : "";
    const description = typeof parsed.description === "string" ? parsed.description.slice(0, 500) : "";
    const imageUrl = typeof parsed.imageUrl === "string" || typeof parsed.image_url === "string" || typeof parsed.image === "string"
      ? (parsed.imageUrl || parsed.image_url || parsed.image || "").slice(0, 2048)
      : "";

    // 少なくとも 1 つのフィールドが非空であれば有効とみなす
    if (!title && !description && !imageUrl) {
      return null;
    }

    return { title, description, imageUrl };
  } catch {
    return null;
  }
}

/**
 * バックグラウンドで OGP メタデータを順次取得する。
 *
 * - エージェントの OGP Fetcher ツールを使用（AgentCore Runtime 経由）
 * - 同時実行数をセマフォパターンで制限（デフォルト 3）
 * - ページ離脱時は AbortSignal でキャンセル
 * - 個別の OGP 取得失敗は無視（グレースフルデグレード）
 * - エージェント未設定時は即座に return（エラーなし）
 *
 * Validates: Requirements 1.2, 1.3, 10.10
 */
export async function fetchOGPInBackground(
  options: OGPBackgroundFetchOptions,
): Promise<void> {
  const {
    bookmarkIds,
    concurrency = 3,
    onFetched,
    signal,
    getBookmarkUrl,
  } = options;

  // エージェント未設定時はスキップ
  const runtimeArn =
    options.runtimeArn || process.env.NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN;
  if (!runtimeArn?.trim()) {
    return;
  }

  // 対象がなければ何もしない
  if (bookmarkIds.length === 0) {
    return;
  }

  // 既にキャンセル済みなら何もしない
  if (signal.aborted) {
    return;
  }

  // 認証トークンを取得
  let accessToken: string;
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (!token) {
      return;
    }
    accessToken = token;
  } catch {
    // 認証失敗時は静かに終了
    return;
  }

  const semaphore = new Semaphore(concurrency);

  const tasks = bookmarkIds.map(async (bookmarkId) => {
    // キャンセルチェック
    if (signal.aborted) {
      return;
    }

    await semaphore.acquire();

    try {
      // キャンセルチェック（acquire 待ち中にキャンセルされた可能性）
      if (signal.aborted) {
        return;
      }

      const url = getBookmarkUrl(bookmarkId);
      if (!url) {
        return;
      }

      const ogpData = await fetchSingleOGP({
        url,
        runtimeArn,
        accessToken,
        signal,
      });

      if (ogpData && !signal.aborted) {
        onFetched(bookmarkId, ogpData);
      }
    } catch {
      // 個別の失敗は無視（グレースフルデグレード）
    } finally {
      semaphore.release();
    }
  });

  // すべてのタスクの完了を待つ（個別の失敗は内部で処理済み）
  await Promise.allSettled(tasks);
}
