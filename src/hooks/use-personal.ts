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

export function newId(): string {
  return crypto.randomUUID();
}
