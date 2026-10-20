"use client";

import { useCallback } from "react";
import { updatePersonalState, useHydrated, usePersonalState, type PersonalState } from "@/lib/personal-store";

/** 개인 상태 + 로그인 여부. 화면 컴포넌트는 이 훅만 쓴다 */
export function usePersonal() {
  const state = usePersonalState();
  const hydrated = useHydrated();
  const update = useCallback((fn: (s: PersonalState) => PersonalState) => updatePersonalState(fn), []);
  return { state, hydrated, loggedIn: state.session !== null, update };
}

/**
 * UUID v4. crypto.randomUUID는 보안 컨텍스트(HTTPS·localhost)에서만 있어서
 * http://IP 주소로 열면 없다. getRandomValues는 어디서나 되므로 그것으로 만든다
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
