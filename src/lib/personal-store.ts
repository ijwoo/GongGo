"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import {
  applicationRecordSchema,
  calendarEventSchema,
  changeAlertPrefsSchema,
  isoInstant,
  notificationSchema,
  savedAnnouncementSchema,
  userProfileSchema,
  type UserProfile,
} from "@/domain/types";

/**
 * 데모 모드의 개인 상태 저장소.
 *
 * - 브라우저 localStorage에만 저장한다. 서버로 보내지 않는다.
 * - 비밀번호·토큰 같은 인증 정보는 저장하지 않는다. 데모 세션은 '데모로 체험 중'이라는 표시일 뿐이다.
 * - 실제 인증·DB를 붙이면 이 모듈의 읽기/쓰기를 API 호출로 바꾸고, 화면 컴포넌트는 그대로 둔다.
 * - 서버 렌더링 때는 빈 상태(EMPTY)를 쓰고, hydration 직후 저장된 값으로 바뀐다.
 */

const demoSessionSchema = z.object({
  kind: z.literal("demo"),
  userId: z.string(),
  displayName: z.string(),
  startedAt: isoInstant,
});
export type DemoSession = z.infer<typeof demoSessionSchema>;

const appliedChangeSchema = z.object({ id: z.string(), appliedAt: isoInstant });

export const personalStateSchema = z.object({
  version: z.literal(1),
  session: demoSessionSchema.nullable(),
  profile: userProfileSchema.nullable(),
  saved: z.array(savedAnnouncementSchema),
  events: z.array(calendarEventSchema),
  notifications: z.array(notificationSchema),
  applications: z.array(applicationRecordSchema),
  changeAlerts: changeAlertPrefsSchema,
  appliedChanges: z.array(appliedChangeSchema),
  sentReminderKeys: z.array(z.string()),
});
export type PersonalState = z.infer<typeof personalStateSchema>;

export const EMPTY_STATE: PersonalState = {
  version: 1,
  session: null,
  profile: null,
  saved: [],
  events: [],
  notifications: [],
  applications: [],
  changeAlerts: { deadline: true, venue: true, conditions: true, cancel: true },
  appliedChanges: [],
  sentReminderKeys: [],
};

const STATE_KEY = "gonggoham:personal:v1";
const COMPARE_KEY = "gonggoham:compare:v1";
export const COMPARE_LIMIT = 3;

type Listener = () => void;
const listeners = new Set<Listener>();
/** localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 메모리에만 둔다 */
const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STATE_KEY || e.key === COMPARE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/* 같은 원문 문자열이면 같은 객체를 돌려줘야 useSyncExternalStore가 무한 렌더링하지 않는다 */
let cachedRaw: string | null | undefined;
let cachedState: PersonalState = EMPTY_STATE;

export function readPersonalState(): PersonalState {
  const raw = readRaw(STATE_KEY);
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  if (!raw) {
    cachedState = EMPTY_STATE;
    return cachedState;
  }
  try {
    const parsed = personalStateSchema.safeParse(JSON.parse(raw));
    cachedState = parsed.success ? parsed.data : EMPTY_STATE;
    if (!parsed.success) console.warn("[공고함] 저장된 개인 상태 형식이 맞지 않아 초기화합니다.", parsed.error.issues.slice(0, 3));
  } catch {
    cachedState = EMPTY_STATE;
  }
  return cachedState;
}

export function updatePersonalState(updater: (prev: PersonalState) => PersonalState) {
  const next = personalStateSchema.parse(updater(readPersonalState()));
  writeRaw(STATE_KEY, JSON.stringify(next));
}

export function usePersonalState(): PersonalState {
  return useSyncExternalStore(subscribe, readPersonalState, () => EMPTY_STATE);
}

/** hydration 이후인지. 서버 스냅샷과 구분해 '불러오는 중'을 표시할 때 쓴다 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
const noopSubscribe = () => () => {};

/* ───────── 비교 선택: 비로그인도 쓸 수 있으므로 따로 저장 ───────── */

let cachedCompareRaw: string | null | undefined;
let cachedCompare: string[] = [];
const EMPTY_COMPARE: string[] = [];

export function readCompare(): string[] {
  const raw = readRaw(COMPARE_KEY);
  if (raw === cachedCompareRaw) return cachedCompare;
  cachedCompareRaw = raw;
  try {
    const parsed = z.array(z.string()).max(COMPARE_LIMIT).safeParse(raw ? JSON.parse(raw) : []);
    cachedCompare = parsed.success ? parsed.data : EMPTY_COMPARE;
  } catch {
    cachedCompare = EMPTY_COMPARE;
  }
  return cachedCompare;
}

export function useCompare(): string[] {
  return useSyncExternalStore(subscribe, readCompare, () => EMPTY_COMPARE);
}

export type CompareResult = "added" | "removed" | "full";

export function toggleCompare(id: string): CompareResult {
  const current = readCompare();
  if (current.includes(id)) {
    writeRaw(COMPARE_KEY, JSON.stringify(current.filter((x) => x !== id)));
    return "removed";
  }
  if (current.length >= COMPARE_LIMIT) return "full";
  writeRaw(COMPARE_KEY, JSON.stringify([...current, id]));
  return "added";
}

export function clearCompare() {
  writeRaw(COMPARE_KEY, null);
}

/* ───────── 데모 세션 ───────── */

/** 데모용 합성 프로필. 실존 인물과 무관하다 */
export const DEMO_PROFILE: UserProfile = {
  interests: ["hackathon", "startup"],
  region: "서울",
  career: "3-5",
  teamSize: 3,
  startupYears: 0,
};

export function startDemoSession(nowIso: string) {
  updatePersonalState((prev) => {
    if (prev.session) return prev;
    return {
      ...prev,
      session: { kind: "demo", userId: "demo-user", displayName: "데모 사용자", startedAt: nowIso },
      profile: prev.profile ?? DEMO_PROFILE,
      // 첫 체험이 비어 보이지 않도록 관심 공고 두 개를 미리 넣어 둔다(변경 이력이 있는 공고)
      saved: prev.saved.length
        ? prev.saved
        : [
            { announcementId: "hk-seongsu-climate", savedAt: nowIso, seenVersion: 1 },
            { announcementId: "su-seoul-prestartup", savedAt: nowIso, seenVersion: 1 },
          ],
    };
  });
}

export function endDemoSession() {
  updatePersonalState((prev) => ({ ...prev, session: null }));
}

/** 데모 데이터 초기화: 개인 상태와 비교 선택을 모두 지운다 */
export function resetDemoData() {
  writeRaw(STATE_KEY, null);
  writeRaw(COMPARE_KEY, null);
}
