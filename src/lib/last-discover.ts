"use client";

import { useSyncExternalStore } from "react";

/**
 * 다른 화면에 갔다가 '발견'으로 돌아올 때 마지막 탐색 상태(필터·뷰·선택)를 복원하기 위한 값.
 * 탭이 닫히면 사라지도록 sessionStorage에 둔다.
 */
const KEY = "gonggoham:last-discover";
const listeners = new Set<() => void>();

export function rememberDiscoverQuery(query: string) {
  try {
    sessionStorage.setItem(KEY, query);
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function useDiscoverHref(): string {
  const q = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "",
  );
  return q ? `/discover?${q}` : "/discover";
}
