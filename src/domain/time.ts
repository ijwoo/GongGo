import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * 시간대 정책
 * - 서비스 기준 시간대는 Asia/Seoul.
 * - 시점은 UTC ISO 문자열로 저장하고, 화면에 보여 줄 때만 Asia/Seoul로 변환한다.
 * - 시각 없는 날짜는 'YYYY-MM-DD'로 저장하며 Date로 바꿔 시점처럼 다루지 않는다.
 * - 서버·브라우저의 로컬 시간대와 무관하게 같은 결과가 나오도록 항상 TZDate를 거친다.
 */
export const SERVICE_TIME_ZONE = "Asia/Seoul";

export type LocalDate = string; // YYYY-MM-DD

export function toSeoul(instant: string | Date | number): TZDate {
  const ms = typeof instant === "string" ? parseISO(instant).getTime() : new Date(instant).getTime();
  return new TZDate(ms, SERVICE_TIME_ZONE);
}

/** 시점이 서울 기준으로 며칠인지 */
export function seoulDateOf(instant: string | Date | number): LocalDate {
  return format(toSeoul(instant), "yyyy-MM-dd");
}

/** 서울 기준 날짜+시각을 UTC ISO 시점으로 */
export function seoulInstant(date: LocalDate, time = "00:00"): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(TZDate.tz(SERVICE_TIME_ZONE, y, m - 1, d, hh, mm).getTime()).toISOString();
}

/** 서울 기준 날짜 계산. 시간대 변환 없이 달력 날짜만 더한다 */
export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return format(addDays(new Date(Date.UTC(y, m - 1, d, 12)), days), "yyyy-MM-dd");
}

/** b - a (달력 날짜 기준) */
export function localDaysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return differenceInCalendarDays(new Date(Date.UTC(by, bm - 1, bd, 12)), new Date(Date.UTC(ay, am - 1, ad, 12)));
}

/** 'YYYY-MM-DD'의 요일(0=일) */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 10월 31일 (금) */
export function formatLocalDate(date: LocalDate, opts: { year?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number);
  const prefix = opts.year ? `${y}년 ` : "";
  return `${prefix}${m}월 ${d}일 (${WEEKDAYS[weekdayOf(date)]})`;
}

/** 10.31 (금) — 표처럼 촘촘한 곳에서 쓰는 짧은 형식 */
export function formatLocalDateShort(date: LocalDate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${WEEKDAYS[weekdayOf(date)]})`;
}

/** 18:00 (서울 기준) */
export function formatSeoulTime(instant: string): string {
  return format(toSeoul(instant), "HH:mm");
}

/** 10월 31일 (금) 18:00 */
export function formatSeoulDateTime(instant: string, opts: { year?: boolean } = {}): string {
  return `${formatLocalDate(seoulDateOf(instant), opts)} ${formatSeoulTime(instant)}`;
}

/** 2026년 10월 */
export function formatMonth(year: number, month1: number): string {
  return `${year}년 ${month1}월`;
}

export function formatRelativeDays(days: number): string {
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  if (days === -1) return "어제";
  return days > 0 ? `${days}일 후` : `${-days}일 전`;
}

export { ko as koLocale };
