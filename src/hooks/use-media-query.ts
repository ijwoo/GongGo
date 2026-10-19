"use client";

import { useSyncExternalStore } from "react";

/** CSS 미디어 쿼리 일치 여부. 서버 렌더링 때는 false */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
