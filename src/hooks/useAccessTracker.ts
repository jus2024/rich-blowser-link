"use client";

import { useCallback, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";

/**
 * useAccessTracker フックの戻り値。
 *
 * Bookmark リンクのクリック時にアクセス回数と最終アクセス日時を記録する。
 * API エラー時はコンソールログのみ出力し、リンク遷移を妨げない。
 *
 * Validates: Requirements 12.1, 12.2, 12.4
 */
export interface UseAccessTrackerReturn {
  trackAccess: (bookmarkId: string) => Promise<void>;
}

/**
 * Bookmark のアクセス追跡を行うカスタムフック。
 *
 * - `trackAccess(bookmarkId)` を呼び出すと、当該 Bookmark の
 *   `accessCount` を 1 インクリメントし、`lastAccessedAt` を
 *   現在の ISO 8601 日時で更新する。
 * - API エラー時はコンソールにログを出力するのみで、例外を投げない。
 *   これによりリンク先への遷移を妨げない。
 * - Amplify 未設定時は何もせずに終了する。
 *
 * Validates: Requirements 12.1, 12.2, 12.4
 */
export function useAccessTracker(): UseAccessTrackerReturn {
  const [client] = useState(() =>
    isAmplifyConfigured() ? generateClient<Schema>() : null,
  );

  const trackAccess = useCallback(
    async (bookmarkId: string): Promise<void> => {
      if (!client) return;

      try {
        // 現在の Bookmark を取得して accessCount を確認する
        const getResponse = await client.models.Bookmark.get({
          id: bookmarkId,
        });

        if (getResponse.errors && getResponse.errors.length > 0) {
          console.error(
            "[useAccessTracker] Bookmark 取得エラー:",
            getResponse.errors,
          );
          return;
        }

        if (!getResponse.data) {
          console.error(
            "[useAccessTracker] Bookmark が見つかりません:",
            bookmarkId,
          );
          return;
        }

        const currentAccessCount = getResponse.data.accessCount ?? 0;

        // accessCount をインクリメントし、lastAccessedAt を更新する
        const updateResponse = await client.models.Bookmark.update({
          id: bookmarkId,
          accessCount: currentAccessCount + 1,
          lastAccessedAt: new Date().toISOString(),
        });

        if (updateResponse.errors && updateResponse.errors.length > 0) {
          console.error(
            "[useAccessTracker] Bookmark 更新エラー:",
            updateResponse.errors,
          );
        }
      } catch (err) {
        console.error("[useAccessTracker] アクセス追跡エラー:", err);
      }
    },
    [client],
  );

  return { trackAccess };
}
