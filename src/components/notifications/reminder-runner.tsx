"use client";

import { useEffect } from "react";
import { newId, usePersonal } from "@/hooks/use-personal";
import { useEmailConfigured, useNow } from "@/lib/app-data";
import { deliverDueReminders } from "@/lib/personal-actions";

/**
 * 예약 시각이 지난 알림을 앱 내 알림으로 만든다.
 * 일정 알림 서버 발송은 아직 없어서, 공고함이 열려 있을 때(또는 다시 열었을 때) 만들고 계정에 저장한다.
 */
export function ReminderRunner() {
  const now = useNow();
  const emailConfigured = useEmailConfigured();
  const { loggedIn, hydrated, update } = usePersonal();

  useEffect(() => {
    if (!hydrated || !loggedIn) return;
    update((s) => deliverDueReminders(s, now, emailConfigured, newId));
  }, [now, hydrated, loggedIn, emailConfigured, update]);

  return null;
}
