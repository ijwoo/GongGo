"use client";

import { createContext, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { seoulDateOf } from "@/domain/time";
import type { Announcement } from "@/domain/types";

interface AppDataValue {
  /** 서버가 정한 요청 시점 */
  serverNow: string;
  baseAnnouncements: Announcement[];
  /** 서버에 이메일 발송 제공자가 설정되어 있는지 */
  emailConfigured: boolean;
  /** 카카오맵 JavaScript 키(도메인 제한이 걸린 공개 키). 없으면 지도 대신 안내를 보여 준다 */
  kakaoMapKey: string | null;
  clock: Clock;
}

interface Clock {
  subscribe: (cb: () => void) => () => void;
  get: () => string;
}

const AppDataContext = createContext<AppDataValue | null>(null);

/** 서버 시각에 맞춘 시계. 브라우저 시계가 틀려도 서버 기준으로 흐르고, 1분 단위로만 바뀐다 */
function createClock(serverNow: string): Clock {
  const serverMs = Date.parse(serverNow);
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
  let cached = serverNow;
  return {
    subscribe(cb) {
      const id = window.setInterval(cb, 30_000);
      return () => window.clearInterval(id);
    },
    get() {
      const elapsed = performance.now() - startedAt;
      const minute = Math.floor((serverMs + elapsed) / 60_000) * 60_000;
      const iso = new Date(Math.max(minute, serverMs)).toISOString();
      if (iso !== cached && Date.parse(iso) > Date.parse(cached)) cached = iso;
      return cached;
    },
  };
}

export function AppDataProvider({
  serverNow,
  announcements,
  emailConfigured,
  kakaoMapKey,
  children,
}: {
  serverNow: string;
  announcements: Announcement[];
  emailConfigured: boolean;
  kakaoMapKey: string | null;
  children: ReactNode;
}) {
  const clockRef = useRef<Clock | null>(null);
  // eslint-disable-next-line react-hooks/refs -- 최초 한 번만 만드는 시계 인스턴스
  if (!clockRef.current) clockRef.current = createClock(serverNow);
  // eslint-disable-next-line react-hooks/refs
  const clock = clockRef.current;
  const value = useMemo(
    () => ({ serverNow, baseAnnouncements: announcements, emailConfigured, kakaoMapKey, clock }),
    [serverNow, announcements, emailConfigured, kakaoMapKey, clock],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("AppDataProvider가 필요합니다.");
  return ctx;
}

/** 현재 시각(서버 기준, 분 단위). 서버 렌더링과 hydration에서는 서버 시각을 그대로 쓴다 */
export function useNow(): string {
  const { clock, serverNow } = useAppData();
  return useSyncExternalStore(clock.subscribe, clock.get, () => serverNow);
}

export function useToday(): string {
  return seoulDateOf(useNow());
}

export function useEmailConfigured(): boolean {
  return useAppData().emailConfigured;
}

export function useKakaoMapKey(): string | null {
  return useAppData().kakaoMapKey;
}

/** 공고 목록. 목록·지도·캘린더·요약이 모두 이 값을 쓴다 */
export function useAnnouncements(): { list: Announcement[]; byId: Map<string, Announcement> } {
  const { baseAnnouncements } = useAppData();
  return useMemo(() => ({ list: baseAnnouncements, byId: new Map(baseAnnouncements.map((a) => [a.id, a])) }), [baseAnnouncements]);
}
