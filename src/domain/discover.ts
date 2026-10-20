import { z } from "zod";
import {
  applicationState,
  deadlineDate,
  mapPointOf,
  type ApplicationState,
} from "./announcement";
import { addLocalDays, seoulDateOf, weekdayOf } from "./time";
import { CATEGORIES, PARTICIPATION_MODES, type Announcement, type Category, type ParticipationMode } from "./types";

/**
 * 발견 화면의 탐색 상태. 전부 URL query에 담는다(공유·뒤로 가기 복원).
 * 사용자 개인 상태(관심 저장, 비교 선택 등)는 여기에 넣지 않는다.
 */
/** 행사 장소의 시·도(약칭). 확정 장소의 주소 또는 시·구 단위 지역의 첫 단어와 맞춘다 */
export const VENUE_REGIONS = [
  "서울",
  "경기",
  "인천",
  "강원",
  "충북",
  "충남",
  "대전",
  "세종",
  "전북",
  "전남",
  "광주",
  "경북",
  "경남",
  "대구",
  "부산",
  "울산",
  "제주",
] as const;
export type VenueRegion = (typeof VENUE_REGIONS)[number];

export const STATUS_FILTERS = ["all", "open", "upcoming", "rolling"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ["deadline", "recent"] as const;
export type Sort = (typeof SORTS)[number];

export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

export interface DiscoverQuery {
  q: string;
  categories: Category[];
  regions: VenueRegion[];
  modes: ParticipationMode[];
  status: StatusFilter;
  includeClosed: boolean;
  sort: Sort;
  view: "list" | "map";
  /** 선택한 공고 */
  id: string | null;
  /** 지도 '이 지역 다시 검색' 범위 */
  bbox: Bbox | null;
  /** 요약 스트립에서 들어온 빠른 필터 */
  quick: "today" | "week" | null;
  /** 온라인 공고 포함. 지역을 고르면 그 지역 공고 + 온라인 공고, 전국이면 끄는 것은 온라인 제외 */
  online: boolean;
  /** 큐레이션 섹션 대신 전체 결과를 한 그리드로 */
  all: boolean;
}

export const DEFAULT_QUERY: DiscoverQuery = {
  q: "",
  categories: [],
  regions: [],
  modes: [],
  status: "all",
  includeClosed: false,
  sort: "deadline",
  view: "list",
  id: null,
  bbox: null,
  quick: null,
  online: true,
  all: false,
};

function csvOf<T extends string>(allowed: readonly T[]) {
  return z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return [] as T[];
      const parts = v.split(",").filter((p): p is T => (allowed as readonly string[]).includes(p));
      return [...new Set(parts)];
    });
}

const bboxSchema = z
  .string()
  .optional()
  .transform((v): Bbox | null => {
    if (!v) return null;
    const n = v.split(",").map(Number);
    if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return null;
    const [minLng, minLat, maxLng, maxLat] = n;
    if (minLng >= maxLng || minLat >= maxLat) return null;
    return [minLng, minLat, maxLng, maxLat];
  });

const querySchema = z.object({
  q: z.string().max(80).optional().catch(undefined),
  cat: csvOf(CATEGORIES),
  region: csvOf(VENUE_REGIONS),
  mode: csvOf(PARTICIPATION_MODES),
  status: z.enum(STATUS_FILTERS).optional().catch(undefined),
  closed: z.literal("1").optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  view: z.enum(["list", "map"]).optional().catch(undefined),
  id: z.string().max(80).optional().catch(undefined),
  bbox: bboxSchema,
  quick: z.enum(["today", "week"]).optional().catch(undefined),
  online: z.literal("0").optional().catch(undefined),
  all: z.literal("1").optional().catch(undefined),
});

/** 잘못된 값은 버리고 기본값으로 돌린다. URL을 손으로 고쳐도 화면이 깨지지 않게 한다 */
export function parseDiscoverQuery(params: URLSearchParams | Record<string, string | undefined>): DiscoverQuery {
  const raw = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_QUERY;
  const p = parsed.data;
  return {
    q: p.q?.trim() ?? "",
    categories: p.cat,
    regions: p.region,
    modes: p.mode,
    status: p.status ?? "all",
    includeClosed: p.closed === "1",
    sort: p.sort ?? "deadline",
    view: p.view ?? "list",
    id: p.id ?? null,
    bbox: p.bbox,
    quick: p.quick ?? null,
    online: p.online !== "0",
    all: p.all === "1",
  };
}

export function serializeDiscoverQuery(q: DiscoverQuery): string {
  const s = new URLSearchParams();
  if (q.q) s.set("q", q.q);
  if (q.categories.length) s.set("cat", q.categories.join(","));
  if (q.regions.length) s.set("region", q.regions.join(","));
  if (q.modes.length) s.set("mode", q.modes.join(","));
  if (q.status !== "all") s.set("status", q.status);
  if (q.includeClosed) s.set("closed", "1");
  if (q.sort !== "deadline") s.set("sort", q.sort);
  if (q.quick) s.set("quick", q.quick);
  if (!q.online) s.set("online", "0");
  if (q.all) s.set("all", "1");
  if (q.view !== "list") s.set("view", q.view);
  if (q.bbox) s.set("bbox", q.bbox.map((n) => n.toFixed(4)).join(","));
  if (q.id) s.set("id", q.id);
  return s.toString();
}

/** 필터 개수(뷰·선택·지도 범위 제외) */
export function activeFilterCount(q: DiscoverQuery): number {
  return (
    (q.q ? 1 : 0) +
    q.categories.length +
    q.regions.length +
    q.modes.length +
    (q.status !== "all" ? 1 : 0) +
    (q.includeClosed ? 1 : 0) +
    (q.quick ? 1 : 0) +
    (q.online ? 0 : 1)
  );
}

/**
 * 큐레이션 섹션을 보여 줄지. 검색어·세부 필터·정렬 변경·'전체 보기'가 있으면 결과 하나의 그리드로 보여 준다.
 * 분야·지역·온라인 포함은 화면 위쪽의 기본 조건이라 큐레이션 안에서도 그대로 적용한다.
 */
export function isCuratedQuery(q: DiscoverQuery): boolean {
  return !q.all && !q.q && q.modes.length === 0 && q.status === "all" && !q.includeClosed && !q.quick && q.sort === "deadline";
}

/** 온라인으로만 진행하는 공고(장소가 없다) */
export function isOnlineOnly(a: Announcement): boolean {
  return a.venue.status === "online" || a.participationMode === "online";
}

export function venueRegionOf(a: Announcement): VenueRegion | null {
  const v = a.venue;
  const text = v.status === "confirmed" ? v.address : v.status === "tbd" ? (v.area?.label ?? "") : "";
  return VENUE_REGIONS.find((r) => text.startsWith(r)) ?? null;
}

/** 이번 주(서울 기준 월~일)의 마지막 날 */
export function endOfWeek(today: string): string {
  const wd = weekdayOf(today); // 0=일
  return addLocalDays(today, wd === 0 ? 0 : 7 - wd);
}

export function isDueThisWeek(a: Announcement, nowIso: string): boolean {
  const state = applicationState(a, nowIso);
  if (state === "closed" || state === "cancelled" || state === "upcoming") return false;
  const date = deadlineDate(a.applicationDeadline);
  if (!date) return false;
  const today = seoulDateOf(nowIso);
  return date >= today && date <= endOfWeek(today);
}

export function isPublishedToday(a: Announcement, nowIso: string): boolean {
  return seoulDateOf(a.publishedAt) === seoulDateOf(nowIso);
}

const CLOSED_STATES: ApplicationState[] = ["closed", "cancelled"];

function matchesText(a: Announcement, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const v = a.venue;
  const place = v.status === "confirmed" ? `${v.district} ${v.name}` : v.status === "tbd" ? (v.area?.label ?? "") : "";
  const hay = [a.title, a.organizer.name, place]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((t) => hay.includes(t));
}

/** 목록·지도·요약이 모두 이 함수 하나의 결과를 쓴다 */
export function filterAnnouncements(list: Announcement[], q: DiscoverQuery, nowIso: string): Announcement[] {
  const result = list.filter((a) => {
    const state = applicationState(a, nowIso);
    if (!q.includeClosed && CLOSED_STATES.includes(state)) return false;
    if (q.status === "open" && state !== "open" && state !== "closingSoon") return false;
    if (q.status === "upcoming" && state !== "upcoming") return false;
    if (q.status === "rolling" && state !== "rolling") return false;
    if (q.categories.length && !q.categories.includes(a.category)) return false;
    if (q.modes.length && !q.modes.includes(a.participationMode)) return false;
    if (q.regions.length) {
      const r = venueRegionOf(a);
      const inRegion = r !== null && q.regions.includes(r);
      if (!inRegion && !(q.online && isOnlineOnly(a))) return false;
    } else if (!q.online && isOnlineOnly(a)) {
      return false;
    }
    if (q.quick === "today" && !isPublishedToday(a, nowIso)) return false;
    if (q.quick === "week" && !isDueThisWeek(a, nowIso)) return false;
    return matchesText(a, q.q);
  });
  return sortAnnouncements(result, q.sort, nowIso);
}

/** 지도 범위 필터. 위치(정확한 장소 또는 지역의 대략 위치)가 있는 공고만 남는다 */
export function withinBbox(list: Announcement[], bbox: Bbox | null): Announcement[] {
  return list.filter((a) => {
    const p = mapPointOf(a);
    if (!p) return false;
    if (!bbox) return true;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return p.lng >= minLng && p.lng <= maxLng && p.lat >= minLat && p.lat <= maxLat;
  });
}

function deadlineSortKey(a: Announcement, nowIso: string): string {
  const state = applicationState(a, nowIso);
  // 마감·취소는 맨 뒤, 고정 마감일이 없는 공고는 그 앞
  if (CLOSED_STATES.includes(state)) return `3`;
  const d = a.applicationDeadline;
  if (d.type === "datetime") return `0${d.at}`;
  // 시각 미공지는 같은 날 시각이 있는 공고보다 뒤에 오도록 하루의 끝으로 정렬만 한다(표시는 하지 않음)
  if (d.type === "date") return `0${seoulInstantEndKey(d.date)}`;
  return d.type === "tbd" ? "1" : "2";
}

function seoulInstantEndKey(date: string): string {
  return `${date}T14:59:59.999Z~`;
}

export function sortAnnouncements(list: Announcement[], sort: Sort, nowIso: string): Announcement[] {
  const copy = [...list];
  if (sort === "recent") {
    copy.sort((a, b) => (a.publishedAt === b.publishedAt ? a.id.localeCompare(b.id) : b.publishedAt.localeCompare(a.publishedAt)));
  } else {
    copy.sort((a, b) => {
      const ka = deadlineSortKey(a, nowIso);
      const kb = deadlineSortKey(b, nowIso);
      return ka === kb ? a.id.localeCompare(b.id) : ka.localeCompare(kb);
    });
  }
  return copy;
}
