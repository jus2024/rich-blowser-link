import { useEffect, useState } from "react";

/**
 * CSS メディアクエリの一致状態をリアクティブに返すカスタムフック。
 *
 * @param query - CSS メディアクエリ文字列（例: "(max-width: 768px)"）
 * @returns メディアクエリが一致しているかどうかの boolean
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener("change", handler);
    return () => {
      mediaQueryList.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}
