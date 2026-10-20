import { EVENT_KIND_LABEL, findDuplicate, pendingRevisions, proposedTiming } from "@/domain/calendar";
import { dueReminders, offsetLabel, type ScheduledReminder } from "@/domain/reminders";
import { formatSeoulDateTime } from "@/domain/time";
import type {
  Announcement,
  AppNotification,
  ApplicationStatus,
  CalendarEvent,
  EventKind,
  Reminder,
  Timing,
} from "@/domain/types";
import type { PersonalState } from "./personal-store";

/**
 * 개인 상태 변경 규칙. 모두 (이전 상태 → 다음 상태) 순수 함수라 단위 테스트로 검증한다.
 * 저장소(localStorage·API)와 무관하게 같은 규칙을 쓴다.
 */

type IdFactory = () => string;

/* ───────── 관심 공고 ───────── */

export function isSaved(s: PersonalState, id: string) {
  return s.saved.some((x) => x.announcementId === id);
}

export function toggleSaved(s: PersonalState, a: Announcement, nowIso: string): PersonalState {
  if (isSaved(s, a.id)) return { ...s, saved: s.saved.filter((x) => x.announcementId !== a.id) };
  return { ...s, saved: [...s.saved, { announcementId: a.id, savedAt: nowIso, seenVersion: a.contentVersion }] };
}

/** 상세를 열어 변경 내용을 본 것으로 표시 */
export function markSeen(s: PersonalState, a: Announcement): PersonalState {
  const target = s.saved.find((x) => x.announcementId === a.id);
  if (!target || target.seenVersion >= a.contentVersion) return s;
  return { ...s, saved: s.saved.map((x) => (x.announcementId === a.id ? { ...x, seenVersion: a.contentVersion } : x)) };
}

export function changedSavedCount(s: PersonalState, byId: Map<string, Announcement>): number {
  return s.saved.filter((x) => {
    const a = byId.get(x.announcementId);
    return a && a.contentVersion > x.seenVersion;
  }).length;
}

/* ───────── 캘린더 ───────── */

export interface NewEventInput {
  announcement: Announcement | null;
  kind: EventKind;
  title: string;
  timing: Timing;
  reminders: Reminder[];
  memo: string;
}

export type AddEventResult = { ok: true; state: PersonalState; event: CalendarEvent } | { ok: false; reason: "duplicate"; existing: CalendarEvent };

export function addEvent(s: PersonalState, input: NewEventInput, nowIso: string, newId: IdFactory): AddEventResult {
  if (input.announcement) {
    const dup = findDuplicate(s.events, input.announcement.id, input.kind);
    if (dup) return { ok: false, reason: "duplicate", existing: dup };
  }
  const event: CalendarEvent = {
    id: newId(),
    announcementId: input.announcement?.id ?? null,
    kind: input.kind,
    title: input.title.trim(),
    timing: input.timing,
    sourceVersion: input.announcement?.contentVersion ?? null,
    reminders: input.reminders,
    memo: input.memo,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ok: true, state: { ...s, events: [...s.events, event] }, event };
}

export function updateEvent(
  s: PersonalState,
  id: string,
  patch: Partial<Pick<CalendarEvent, "title" | "timing" | "reminders" | "memo">>,
  nowIso: string,
): PersonalState {
  return { ...s, events: s.events.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowIso } : e)) };
}

export function deleteEvent(s: PersonalState, id: string): PersonalState {
  return { ...s, events: s.events.filter((e) => e.id !== id) };
}

/**
 * 공고 변경 확인.
 * accept=true면 공고의 새 시각으로 일정을 바꾼다. 일정 시각이 바뀌면 알림 키도 바뀌어
 * 예전 시각 기준 알림은 다시 보내지 않고, 새 시각 기준으로 다시 계산된다.
 * accept=false면 시각은 그대로 두고 확인한 버전만 올린다.
 */
export function resolveEventChange(s: PersonalState, eventId: string, a: Announcement, accept: boolean, nowIso: string): PersonalState {
  return {
    ...s,
    events: s.events.map((e) => {
      if (e.id !== eventId) return e;
      const timing = accept ? (proposedTiming(e, a) ?? e.timing) : e.timing;
      return { ...e, timing, sourceVersion: a.contentVersion, updatedAt: nowIso };
    }),
  };
}

/* ───────── 알림 ───────── */

function pushNotification(s: PersonalState, n: AppNotification): PersonalState {
  if (s.notifications.some((x) => x.dedupeKey === n.dedupeKey)) return s;
  return { ...s, notifications: [n, ...s.notifications].slice(0, 200) };
}

function reminderNotification(
  r: ScheduledReminder,
  event: CalendarEvent,
  nowIso: string,
  emailConfigured: boolean,
  newId: IdFactory,
): AppNotification {
  const when = event.timing.type === "timed" ? formatSeoulDateTime(event.timing.start) : null;
  const base = {
    id: newId(),
    type: "reminder" as const,
    title: `${EVENT_KIND_LABEL[event.kind]} ${offsetLabel(r.reminder.offset)} 알림`,
    body: `${event.title}${when ? ` · ${when}` : ""}`,
    createdAt: nowIso,
    read: false,
    link: { kind: "event" as const, id: event.id },
    dedupeKey: r.key,
  };
  if (r.reminder.channel === "email" && !emailConfigured) {
    return { ...base, delivery: "failed", failureReason: "이메일 발송 제공자가 설정되지 않아 보내지 못했어요." };
  }
  return { ...base, delivery: "delivered" };
}

/** 지금 시각까지 도래한 알림을 앱 내 알림으로 만든다(앱이 열려 있을 때만 동작) */
export function deliverDueReminders(s: PersonalState, nowIso: string, emailConfigured: boolean, newId: IdFactory): PersonalState {
  const sent = new Set(s.sentReminderKeys);
  const due = dueReminders(s.events, nowIso, sent);
  if (due.length === 0) return s;
  let next = s;
  for (const r of due) {
    const event = s.events.find((e) => e.id === r.eventId)!;
    next = pushNotification(next, reminderNotification(r, event, nowIso, emailConfigured, newId));
  }
  return { ...next, sentReminderKeys: [...s.sentReminderKeys, ...due.map((r) => r.key)].slice(-1000) };
}

export function markNotificationRead(s: PersonalState, id: string): PersonalState {
  return { ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) };
}

export function markAllNotificationsRead(s: PersonalState): PersonalState {
  return { ...s, notifications: s.notifications.map((n) => (n.read ? n : { ...n, read: true })) };
}

/** 확인이 필요한 일정(공고가 바뀐 뒤 아직 확인하지 않음) */
export function eventsNeedingReview(s: PersonalState, byId: Map<string, Announcement>) {
  return s.events
    .map((e) => ({ event: e, revisions: pendingRevisions(e, e.announcementId ? byId.get(e.announcementId) : undefined) }))
    .filter((x) => x.revisions.length > 0);
}

/* ───────── 지원 현황 ───────── */

export function upsertApplication(
  s: PersonalState,
  a: Announcement,
  patch: Partial<{ status: ApplicationStatus; memo: string; checklist: PersonalState["applications"][number]["checklist"] }>,
  nowIso: string,
  newId: IdFactory,
): PersonalState {
  const existing = s.applications.find((x) => x.announcementId === a.id);
  if (existing) {
    return {
      ...s,
      applications: s.applications.map((x) => (x.announcementId === a.id ? { ...x, ...patch, updatedAt: nowIso } : x)),
    };
  }
  const record = {
    announcementId: a.id,
    status: "reviewing" as const,
    memo: "",
    // 준비 서류를 체크리스트로 미리 넣어 둔다
    checklist: a.requiredDocuments.map((label) => ({ id: newId(), label, done: false })),
    updatedAt: nowIso,
    ...patch,
  };
  return { ...s, applications: [...s.applications, record] };
}

export function removeApplication(s: PersonalState, announcementId: string): PersonalState {
  return { ...s, applications: s.applications.filter((x) => x.announcementId !== announcementId) };
}
