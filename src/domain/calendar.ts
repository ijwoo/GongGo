import { addLocalDays, formatLocalDate, formatSeoulDateTime, formatSeoulTime, seoulDateOf, type LocalDate } from "./time";
import type { Announcement, AnnouncementRevision, CalendarEvent, EventKind, RevisionKind, Timing } from "./types";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  deadline: "신청 마감",
  event: "행사·교육",
  prep: "준비 일정",
};

export type TimingOption = { available: true; timing: Timing } | { available: false; reason: string };

/**
 * 공고에서 만들 수 있는 일정.
 * 고정 날짜가 없는 마감(상시·예산 소진 시·미정)은 날짜로 바꾸지 않고 '추가할 수 없음'으로 돌려준다.
 */
export function timingFromAnnouncement(a: Announcement, kind: Exclude<EventKind, "prep">): TimingOption {
  if (kind === "deadline") {
    const d = a.applicationDeadline;
    switch (d.type) {
      case "datetime":
        return { available: true, timing: { type: "timed", start: d.at, end: null } };
      case "date":
        return { available: true, timing: { type: "allDay", start: d.date, end: d.date, timeUnknown: true } };
      case "rolling":
        return { available: false, reason: "상시 모집이라 마감일이 없어요." };
      case "untilBudget":
        return { available: false, reason: "예산 소진 시 마감이라 정해진 마감일이 없어요." };
      case "tbd":
        return { available: false, reason: "마감일이 아직 공지되지 않았어요." };
    }
  }
  const e = a.event;
  switch (e.type) {
    case "dates":
      return { available: true, timing: { type: "allDay", start: e.start, end: e.end, timeUnknown: false } };
    case "datetime":
      return { available: true, timing: { type: "timed", start: e.start, end: e.end } };
    case "tbd":
      return { available: false, reason: "행사 일정이 아직 정해지지 않았어요." };
    case "ongoing":
      return { available: false, reason: "상시 진행이라 특정 일정이 없어요." };
  }
}

/** 공고 연결 일정 중 신청 마감·행사 일정은 공고당 하나만 둔다. 준비 일정은 여러 개 가능 */
export function findDuplicate(events: CalendarEvent[], announcementId: string, kind: EventKind): CalendarEvent | null {
  if (kind === "prep") return null;
  return events.find((e) => e.announcementId === announcementId && e.kind === kind) ?? null;
}

export function timingStartDate(t: Timing): LocalDate {
  return t.type === "allDay" ? t.start : seoulDateOf(t.start);
}

export function timingEndDate(t: Timing): LocalDate {
  if (t.type === "allDay") return t.end;
  return t.end ? seoulDateOf(t.end) : seoulDateOf(t.start);
}

export function occursOn(e: CalendarEvent, date: LocalDate): boolean {
  return timingStartDate(e.timing) <= date && date <= timingEndDate(e.timing);
}

/** 정렬용 키. 같은 날이면 종일 일정이 먼저 */
export function timingSortKey(t: Timing): string {
  return t.type === "allDay" ? `${t.start}T00` : `${seoulDateOf(t.start)}T01${t.start}`;
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => timingSortKey(a.timing).localeCompare(timingSortKey(b.timing)) || a.id.localeCompare(b.id));
}

/** 오늘 이후(오늘 포함)에 끝나는 일정 */
export function upcomingEvents(events: CalendarEvent[], today: LocalDate): CalendarEvent[] {
  return sortEvents(events.filter((e) => timingEndDate(e.timing) >= today));
}

/** 일정 종류별로 영향을 주는 변경 */
const RELEVANT_REVISIONS: Record<EventKind, RevisionKind[]> = {
  deadline: ["deadline", "cancel"],
  event: ["venue", "cancel"],
  prep: ["deadline", "conditions", "cancel"],
};

/**
 * 일정을 만든 뒤 공고가 바뀌었으면 사용자가 확인해야 할 변경 목록을 돌려준다.
 * 비어 있으면 확인할 것이 없다.
 */
export function pendingRevisions(e: CalendarEvent, a: Announcement | undefined): AnnouncementRevision[] {
  if (!a || e.sourceVersion === null || e.sourceVersion >= a.contentVersion) return [];
  return a.revisions.filter((r) => r.version > e.sourceVersion! && RELEVANT_REVISIONS[e.kind].includes(r.kind));
}

/** 변경 확인 후 일정에 반영할 새 시각. 공고 기준 시각이 없으면 null(기존 유지) */
export function proposedTiming(e: CalendarEvent, a: Announcement): Timing | null {
  if (e.kind === "prep" || a.status === "cancelled") return null;
  const option = timingFromAnnouncement(a, e.kind);
  if (!option.available) return null;
  return sameTiming(option.timing, e.timing) ? null : option.timing;
}

export function sameTiming(a: Timing, b: Timing): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 알림 중복 방지 키에 쓰는 시각 식별자. 시각이 바뀌면 키도 바뀐다 */
export function timingKey(t: Timing): string {
  return t.type === "allDay" ? `d:${t.start}:${t.end}` : `t:${t.start}:${t.end ?? ""}`;
}

/** 준비 일정 기본 날짜: 마감 3일 전, 마감일이 없으면 내일 */
export function defaultPrepDate(a: Announcement | null, today: LocalDate): LocalDate {
  const d = a?.applicationDeadline;
  const deadline = d?.type === "datetime" ? seoulDateOf(d.at) : d?.type === "date" ? d.date : null;
  const candidate = deadline ? addLocalDays(deadline, -3) : addLocalDays(today, 1);
  return candidate < today ? today : candidate;
}

/** 월간 달력(일요일 시작)에 표시할 날짜 6주치 */
export function monthGrid(year: number, month1: number): LocalDate[] {
  const first = `${year}-${String(month1).padStart(2, "0")}-01`;
  const [y, m] = [year, month1];
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
  const start = addLocalDays(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addLocalDays(start, i));
}

/** 일정 시각을 사람이 읽는 문장으로 */
export function formatTiming(t: Timing): string {
  if (t.type === "allDay") {
    const range = t.start === t.end ? formatLocalDate(t.start) : `${formatLocalDate(t.start)} ~ ${formatLocalDate(t.end)}`;
    return t.timeUnknown ? `${range} · 시각 미공지` : `${range} · 종일`;
  }
  if (!t.end) return formatSeoulDateTime(t.start);
  return seoulDateOf(t.start) === seoulDateOf(t.end)
    ? `${formatSeoulDateTime(t.start)} ~ ${formatSeoulTime(t.end)}`
    : `${formatSeoulDateTime(t.start)} ~ ${formatSeoulDateTime(t.end)}`;
}
