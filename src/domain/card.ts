import { applicationState, daysUntilDeadline } from "./announcement";
import { addLocalDays, seoulDateOf, weekdayOf, type LocalDate } from "./time";
import type { Announcement } from "./types";

/** 11.07 */
export function mmdd(date: LocalDate): string {
  const [, m, d] = date.split("-");
  return `${m}.${d}`;
}

/**
 * 카드의 행사일. 신청 마감과 섞지 않는다.
 * 행사 개념이 없는 채용·창업 지원은 일정이 없으면 표시하지 않는다(null).
 */
export function cardEventLabel(a: Announcement): string | null {
  const e = a.event;
  if (e.type === "dates") return `행사 ${e.start === e.end ? mmdd(e.start) : `${mmdd(e.start)}–${mmdd(e.end)}`}`;
  if (e.type === "datetime") {
    const s = seoulDateOf(e.start);
    const t = seoulDateOf(e.end);
    return `행사 ${s === t ? mmdd(s) : `${mmdd(s)}–${mmdd(t)}`}`;
  }
  if (e.type === "ongoing") return "상시 진행";
  if (a.category === "job" || a.category === "startup") return null;
  return "행사 일정 미정";
}

export interface CardDeadline {
  label: string;
  /** 접수 중이고 마감이 3일 이내일 때만 */
  urgent: boolean;
}

/** 카드의 신청 마감. 확인되지 않은 마감을 지어내지 않는다 */
export function cardDeadline(a: Announcement, nowIso: string): CardDeadline {
  const d = a.applicationDeadline;
  const state = applicationState(a, nowIso);
  if (d.type === "rolling") return { label: "상시 모집", urgent: false };
  if (d.type === "untilBudget") return { label: "예산 소진 시 마감", urgent: false };
  if (d.type === "tbd") return { label: "마감 미확인", urgent: false };
  const date = d.type === "datetime" ? seoulDateOf(d.at) : d.date;
  if (state === "closed") return { label: `마감됨 ${mmdd(date)}`, urgent: false };
  return { label: `마감 ${mmdd(date)}`, urgent: state === "closingSoon" };
}

/** 정렬 키 비교. localeCompare는 기호(~)를 숫자보다 앞에 두므로 문자 코드 순으로 비교한다 */
function byCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayLabel(date: LocalDate): string {
  return WEEKDAY[weekdayOf(date)];
}

/** 오늘이 속한 주의 월~일(서울 날짜) */
export function weekOf(today: LocalDate): LocalDate[] {
  const wd = weekdayOf(today); // 0=일
  const monday = addLocalDays(today, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 7 }, (_, i) => addLocalDays(monday, i));
}

/**
 * 곧 마감하는 공고: 접수 중이고 마감일이 확인된 공고만, 마감이 가까운 순.
 * 마감·취소·마감일 미확인·상시 모집은 뺀다.
 */
export function closingSoonList(list: Announcement[], nowIso: string, limit = 3): Announcement[] {
  return list
    .filter((a) => {
      const s = applicationState(a, nowIso);
      const t = a.applicationDeadline.type;
      return (s === "open" || s === "closingSoon") && (t === "datetime" || t === "date") && (daysUntilDeadline(a, nowIso) ?? -1) >= 0;
    })
    .sort((x, y) => byCode(deadlineKey(x), deadlineKey(y)) || byCode(x.id, y.id))
    .slice(0, limit);
}

function deadlineKey(a: Announcement): string {
  const d = a.applicationDeadline;
  // 시각 미공지는 같은 날 시각이 있는 공고보다 뒤(그날 끝까지 접수)
  if (d.type === "datetime") return d.at;
  if (d.type === "date") return `${d.date}T14:59:59.999Z~`;
  return "~";
}

/** 공고 id로 표지 템플릿을 고른다. 렌더링마다 바뀌지 않는다 */
export function posterVariant(id: string, count = 5): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % count;
}

function eventStartKey(a: Announcement): string {
  const e = a.event;
  if (e.type === "dates") return e.start;
  if (e.type === "datetime") return seoulDateOf(e.start);
  return "~"; // 일정이 없으면 뒤로
}

/**
 * ‘이번 주 눈여겨볼 기회’: 지금 신청할 수 있는 공고(접수 중·마감 임박·상시) 중 행사가 가까운 순.
 * 추천 점수가 아니라 이 규칙 그대로이며, 화면 설명도 이 규칙대로 쓴다.
 */
export function pickOpenNow(list: Announcement[], nowIso: string, limit = 3): Announcement[] {
  const today = seoulDateOf(nowIso);
  return list
    .filter((a) => {
      const s = applicationState(a, nowIso);
      return s === "open" || s === "closingSoon" || s === "rolling";
    })
    .sort((x, y) => {
      const kx = eventStartKey(x) >= today ? eventStartKey(x) : "~";
      const ky = eventStartKey(y) >= today ? eventStartKey(y) : "~";
      return byCode(kx, ky) || byCode(x.id, y.id);
    })
    .slice(0, limit);
}

/** ‘새로 올라온 공고’: 등록이 최근인 순. 앞 섹션에 나온 공고는 다시 보여 주지 않는다 */
export function pickRecent(list: Announcement[], exclude: Set<string>, limit = 3): Announcement[] {
  return list
    .filter((a) => !exclude.has(a.id))
    .sort((x, y) => byCode(y.publishedAt, x.publishedAt) || byCode(x.id, y.id))
    .slice(0, limit);
}
