import type { Announcement, Category, Deadline, EventSchedule, ParticipationMode, Venue } from "./types";
import {
  formatLocalDate,
  formatLocalDateShort,
  formatSeoulDateTime,
  formatSeoulTime,
  localDaysBetween,
  seoulDateOf,
  type LocalDate,
} from "./time";

export const CATEGORY_LABEL: Record<Category, string> = {
  hackathon: "해커톤",
  startup: "창업 지원",
  education: "교육",
  event: "개발자 행사",
};

export const MODE_LABEL: Record<ParticipationMode, string> = {
  online: "온라인",
  offline: "오프라인",
  hybrid: "혼합",
};

export type ApplicationState = "upcoming" | "open" | "closingSoon" | "closed" | "rolling" | "cancelled";

export const STATE_LABEL: Record<ApplicationState, string> = {
  upcoming: "접수 예정",
  open: "접수 중",
  closingSoon: "마감 임박",
  closed: "마감",
  rolling: "상시 모집",
  cancelled: "취소됨",
};

/** 마감일(서울 기준 날짜). 고정 날짜가 없으면 null */
export function deadlineDate(deadline: Deadline): LocalDate | null {
  if (deadline.type === "datetime") return seoulDateOf(deadline.at);
  if (deadline.type === "date") return deadline.date;
  return null;
}

/**
 * 접수 상태.
 * - 시각이 공지되지 않은 마감일은 그날이 끝날 때까지 '접수 중'으로 본다(23:59로 단정하지 않음).
 * - 상시·예산 소진 시 모집은 마감일이 없으므로 날짜로 판단하지 않는다.
 */
export function applicationState(a: Announcement, nowIso: string): ApplicationState {
  if (a.status === "cancelled") return "cancelled";
  const today = seoulDateOf(nowIso);
  const start = a.applicationStart;
  if (start.type === "datetime" && start.at > nowIso) return "upcoming";
  if (start.type === "date" && start.date > today) return "upcoming";

  const d = a.applicationDeadline;
  if (d.type === "rolling" || d.type === "untilBudget") return "rolling";
  if (d.type === "tbd") return "open";
  if (d.type === "datetime" && d.at <= nowIso) return "closed";
  if (d.type === "date" && d.date < today) return "closed";
  const days = localDaysBetween(today, deadlineDate(d)!);
  return days <= 3 ? "closingSoon" : "open";
}

/** 마감까지 남은 날(서울 달력 기준). 고정 마감일이 없으면 null */
export function daysUntilDeadline(a: Announcement, nowIso: string): number | null {
  const date = deadlineDate(a.applicationDeadline);
  return date ? localDaysBetween(seoulDateOf(nowIso), date) : null;
}

export function formatDeadline(d: Deadline, opts: { short?: boolean } = {}): string {
  switch (d.type) {
    case "datetime":
      return opts.short
        ? `${formatLocalDateShort(seoulDateOf(d.at))} ${formatSeoulTime(d.at)}`
        : formatSeoulDateTime(d.at);
    case "date":
      return opts.short ? formatLocalDateShort(d.date) : `${formatLocalDate(d.date)} · 시각 미공지`;
    case "rolling":
      return "상시 모집";
    case "untilBudget":
      return "예산 소진 시 마감";
    case "tbd":
      return "미정";
  }
}

export function formatEventSchedule(e: EventSchedule): string {
  switch (e.type) {
    case "dates":
      return e.start === e.end
        ? formatLocalDate(e.start)
        : `${formatLocalDate(e.start)} ~ ${formatLocalDate(e.end)}`;
    case "datetime": {
      const sameDay = seoulDateOf(e.start) === seoulDateOf(e.end);
      return sameDay
        ? `${formatSeoulDateTime(e.start)} ~ ${formatSeoulTime(e.end)}`
        : `${formatSeoulDateTime(e.start)} ~ ${formatSeoulDateTime(e.end)}`;
    }
    case "tbd":
      return "미정";
    case "ongoing":
      return "상시 진행";
  }
}

export function formatVenue(v: Venue): string {
  if (v.status === "confirmed") return `${v.name} · ${v.address}`;
  if (v.status === "online") return v.platform ? `온라인 (${v.platform})` : "온라인";
  return v.note ? `장소 미정 (${v.note})` : "장소 미정";
}

/** 목록에 쓰는 짧은 장소 표기 */
export function venueShort(a: Announcement): string {
  const v = a.venue;
  if (v.status === "confirmed") return v.district;
  if (v.status === "online") return "온라인";
  return "장소 미정";
}

export function formatTeamSize(t: Announcement["teamSize"]): string {
  if (!t) return "정보 없음";
  const range =
    t.min && t.max ? (t.min === t.max ? `${t.min}명` : `${t.min}~${t.max}명`) : t.max ? `최대 ${t.max}명` : t.min ? `${t.min}명 이상` : "";
  return [range, t.note].filter(Boolean).join(" · ") || "정보 없음";
}

export function formatKrw(amount: number): string {
  if (amount >= 100_000_000 && amount % 10_000_000 === 0) return `${amount / 100_000_000}억원`;
  if (amount >= 10_000) return `${(amount / 10_000).toLocaleString("ko-KR")}만원`;
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatCost(c: Announcement["cost"]): string {
  if (!c) return "정보 없음";
  return c.type === "free" ? "무료" : formatKrw(c.amountKrw);
}

export function formatSupport(s: Announcement["supportAmount"]): string {
  if (!s) return "정보 없음";
  if (s.type === "none") return "없음";
  if (s.type === "text") return s.text;
  return `최대 ${formatKrw(s.maxKrw)}${s.note ? ` · ${s.note}` : ""}`;
}

export type LocatedAnnouncement = Announcement & { venue: Extract<Venue, { status: "confirmed" }> };

export function hasCoordinates(a: Announcement): a is LocatedAnnouncement {
  return a.venue.status === "confirmed";
}
