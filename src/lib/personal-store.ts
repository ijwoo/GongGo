"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import {
  applicationRecordSchema,
  calendarEventSchema,
  changeAlertPrefsSchema,
  notificationSchema,
  savedAnnouncementSchema,
  userProfileSchema,
} from "@/domain/types";
import { diffPersonal, type SyncOp } from "./personal-sync";

/**
 * 개인 상태 저장소(로그인한 사용자의 관심 공고·일정·알림·지원 현황·설정).
 *
 * - 원본은 서버(DB)에 있다. 화면을 열 때 GET /api/me로 한 번 읽고, 이후 변경은 화면에 바로 반영한 뒤
 *   차이(personal-sync)만 서버에 보낸다. 서버가 거절하면 최신 상태를 다시 읽어 화면을 맞춘다.
 * - 로그인은 카카오(서버 세션 쿠키, HttpOnly). 브라우저에는 토큰을 저장하지 않는다.
 * - 서버 렌더링 때는 빈 상태(EMPTY)를 쓰고, 불러오기가 끝나면 hydrated가 된다.
 * - 비교 선택은 로그인 없이도 쓰는 임시 선택이라 이 브라우저(localStorage)에만 둔다.
 */

const sessionSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
});
export type UserSession = z.infer<typeof sessionSchema>;

export const personalStateSchema = z.object({
  version: z.literal(1),
  session: sessionSchema.nullable(),
  profile: userProfileSchema.nullable(),
  saved: z.array(savedAnnouncementSchema),
  events: z.array(calendarEventSchema),
  notifications: z.array(notificationSchema),
  applications: z.array(applicationRecordSchema),
  changeAlerts: changeAlertPrefsSchema,
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
  sentReminderKeys: [],
};

/** GET /api/me 응답 */
export const meResponseSchema = z.object({
  user: z.object({ id: z.number().int(), nickname: z.string().nullable() }),
  profile: userProfileSchema.nullable(),
  saved: z.array(savedAnnouncementSchema),
  events: z.array(calendarEventSchema),
  notifications: z.array(notificationSchema),
  applications: z.array(applicationRecordSchema),
  changeAlerts: changeAlertPrefsSchema,
  sentReminderKeys: z.array(z.string()),
});

export function stateFromMe(me: z.infer<typeof meResponseSchema>): PersonalState {
  return {
    version: 1,
    session: { userId: String(me.user.id), displayName: me.user.nickname ?? "카카오 사용자" },
    profile: me.profile,
    saved: me.saved,
    events: me.events,
    notifications: me.notifications,
    applications: me.applications,
    changeAlerts: me.changeAlerts,
    sentReminderKeys: me.sentReminderKeys,
  };
}

const authSessionSchema = z.object({
  authenticated: z.boolean(),
  kakaoEnabled: z.boolean(),
  testLoginEnabled: z.boolean(),
});
export interface AuthConfig {
  kakaoEnabled: boolean;
  testLoginEnabled: boolean;
}

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
    if (e.key === COMPARE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/* ───────── 서버와 맞춘 상태 ───────── */

type Status = "loading" | "ready" | "error";
let state: PersonalState = EMPTY_STATE;
let status: Status = "loading";
let auth: AuthConfig = { kakaoEnabled: false, testLoginEnabled: false };
const errorListeners = new Set<(message: string) => void>();

let loadedWaiters: (() => void)[] = [];

function set(next: PersonalState, nextStatus: Status = status) {
  state = next;
  status = nextStatus;
  if (status !== "loading") {
    loadedWaiters.forEach((w) => w());
    loadedWaiters = [];
  }
  listeners.forEach((l) => l());
}

/** 로그인 상태를 아직 불러오는 중이면 끝날 때까지 기다린다(화면을 열자마자 누른 동작이 로그인 안내로 새지 않게) */
export function whenPersonalLoaded(): Promise<void> {
  if (status !== "loading") return Promise.resolve();
  return new Promise((resolve) => loadedWaiters.push(resolve));
}

function csrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") {
    const token = csrfToken();
    if (token) headers["x-xsrf-token"] = token;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string; title?: string }).detail ?? "";
    } catch {
      // 본문 없음
    }
    throw new ApiError(res.status, detail || `요청이 실패했어요 (${res.status})`);
  }
  return res;
}

/** 로그인 상태와 개인 데이터를 서버에서 읽는다. 화면을 열 때와 저장 실패 뒤에 부른다 */
export async function loadPersonal(): Promise<void> {
  try {
    const session = authSessionSchema.parse(await (await api("GET", "/api/auth/session")).json());
    auth = { kakaoEnabled: session.kakaoEnabled, testLoginEnabled: session.testLoginEnabled };
    if (!session.authenticated) {
      set(EMPTY_STATE, "ready");
      return;
    }
    const me = meResponseSchema.parse(await (await api("GET", "/api/me")).json());
    set(stateFromMe(me), "ready");
  } catch (error) {
    console.error("[공고함] 개인 데이터를 불러오지 못했습니다", error);
    set(EMPTY_STATE, "error");
  }
}

let started = false;
/** 앱에서 한 번만 불러온다 */
export function ensurePersonalLoaded() {
  if (started) return;
  started = true;
  void loadPersonal();
}

export function onSyncError(listener: (message: string) => void): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

/* 서버에 보낼 변경은 순서대로 하나씩 보낸다 */
let queue: Promise<void> = Promise.resolve();

function enqueue(ops: SyncOp[]) {
  if (ops.length === 0) return;
  queue = queue.then(async () => {
    try {
      for (const op of ops) await api(op.method, op.path, op.body);
    } catch (error) {
      const e = error instanceof ApiError ? error : null;
      const message =
        e?.status === 401
          ? "로그인이 만료됐어요. 다시 로그인해 주세요."
          : e?.status === 409
            ? e.message
            : "저장하지 못했어요. 최신 상태를 다시 불러왔어요.";
      errorListeners.forEach((l) => l(message));
      await loadPersonal();
    }
  });
}

export function readPersonalState(): PersonalState {
  return state;
}

export function updatePersonalState(updater: (prev: PersonalState) => PersonalState) {
  const prev = state;
  if (!prev.session) return; // 로그인 전에는 저장할 곳이 없다(화면은 로그인 안내를 먼저 띄운다)
  const next = personalStateSchema.parse(updater(prev));
  if (next === prev) return;
  set(next);
  enqueue(diffPersonal(prev, next));
}

/** 서버에 보낸 변경이 모두 끝날 때까지 기다린다(로그아웃 직전 등) */
export function flushPersonal(): Promise<void> {
  return queue;
}

export function usePersonalState(): PersonalState {
  return useSyncExternalStore(subscribe, readPersonalState, () => EMPTY_STATE);
}

/** 불러오기가 끝났는지. 끝나기 전에는 '불러오는 중'을 보여 준다 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => status !== "loading",
    () => false,
  );
}

export function useAuthConfig(): AuthConfig {
  return useSyncExternalStore(
    subscribe,
    () => auth,
    () => auth,
  );
}

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

/* ───────── 로그인·로그아웃·탈퇴 ───────── */

const RETURN_TO_KEY = "gonggoham:returnTo";

/** 같은 사이트 안의 경로만 돌아갈 곳으로 허용한다(외부 주소로 보내는 열린 리다이렉트 방지) */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/discover";
  return value;
}

/** 카카오 로그인 화면으로 이동한다. 로그인이 끝나면 /login/complete가 returnTo로 되돌려 보낸다 */
export function startKakaoLogin(returnTo: string) {
  try {
    window.sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo(returnTo));
  } catch {
    // 저장할 수 없으면 기본 화면으로 돌아간다
  }
  // 페이지가 아니라 백엔드로 프록시되는 경로(카카오 인증 화면으로 리다이렉트)라 전체 이동이 맞다
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/oauth2/authorization/kakao");
}

export function takeReturnTo(): string {
  try {
    const v = window.sessionStorage.getItem(RETURN_TO_KEY);
    window.sessionStorage.removeItem(RETURN_TO_KEY);
    return safeReturnTo(v);
  } catch {
    return "/discover";
  }
}

/** 테스트 전용 로그인(E2E·로컬). 서버가 켜 둔 경우에만 화면에 버튼이 보인다 */
export async function testLogin(nickname: string): Promise<void> {
  await api("POST", "/api/auth/test-login", { nickname });
  await loadPersonal();
}

export async function signOut(): Promise<void> {
  await flushPersonal();
  await api("POST", "/api/auth/logout");
  await loadPersonal();
}

/** 탈퇴: 계정과 서버의 개인 데이터를 모두 지운다 */
export async function deleteAccount(): Promise<void> {
  await flushPersonal();
  await api("DELETE", "/api/me");
  clearCompare();
  await loadPersonal();
}
