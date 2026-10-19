import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  filterAnnouncements,
  isDueThisWeek,
  parseDiscoverQuery,
  serializeDiscoverQuery,
  withinBbox,
} from "@/domain/discover";
import { hasCoordinates } from "@/domain/announcement";
import { ANNOUNCEMENTS, NOW } from "./fixtures";

describe("발견 화면 URL 상태", () => {
  it("직렬화 → 파싱하면 같은 상태로 복원된다", () => {
    const q = {
      ...DEFAULT_QUERY,
      q: "판교",
      categories: ["hackathon", "event"] as const,
      regions: ["경기"] as const,
      modes: ["offline"] as const,
      status: "open" as const,
      includeClosed: true,
      sort: "recent" as const,
      view: "map" as const,
      id: "hk-pangyo-ai",
      bbox: [126.9, 37.3, 127.2, 37.6] as [number, number, number, number],
    };
    const restored = parseDiscoverQuery(new URLSearchParams(serializeDiscoverQuery({ ...q, categories: [...q.categories], regions: [...q.regions], modes: [...q.modes] })));
    expect(restored).toEqual({ ...q, categories: [...q.categories], regions: [...q.regions], modes: [...q.modes] });
  });

  it("잘못된 값은 버리고 기본값을 쓴다", () => {
    const q = parseDiscoverQuery(new URLSearchParams("cat=hackathon,nope&sort=weird&view=3d&bbox=1,2,x,4&status=zzz"));
    expect(q.categories).toEqual(["hackathon"]);
    expect(q.sort).toBe("deadline");
    expect(q.view).toBe("list");
    expect(q.bbox).toBeNull();
    expect(q.status).toBe("all");
  });

  it("기본값은 주소에 쓰지 않는다", () => {
    expect(serializeDiscoverQuery(DEFAULT_QUERY)).toBe("");
  });
});

describe("필터·정렬", () => {
  it("기본으로 마감·취소 공고를 숨기고, 포함하면 보여 준다", () => {
    const base = filterAnnouncements(ANNOUNCEMENTS, DEFAULT_QUERY, NOW);
    const all = filterAnnouncements(ANNOUNCEMENTS, { ...DEFAULT_QUERY, includeClosed: true }, NOW);
    expect(all.length).toBe(ANNOUNCEMENTS.length);
    expect(base.some((a) => a.status === "cancelled")).toBe(false);
    expect(base.length).toBeLessThan(all.length);
  });

  it("분야·방식·지역 필터를 함께 적용한다", () => {
    const r = filterAnnouncements(ANNOUNCEMENTS, { ...DEFAULT_QUERY, categories: ["hackathon"], modes: ["offline"], regions: ["경기"] }, NOW);
    expect(r.length).toBeGreaterThan(0);
    for (const a of r) {
      expect(a.category).toBe("hackathon");
      expect(a.participationMode).toBe("offline");
      expect(a.venue.status === "confirmed" && a.venue.address.startsWith("경기")).toBe(true);
    }
  });

  it("검색어는 공고명·기관·장소에서 찾는다", () => {
    const r = filterAnnouncements(ANNOUNCEMENTS, { ...DEFAULT_QUERY, q: "판교" }, NOW);
    expect(r.map((a) => a.id)).toContain("hk-pangyo-ai");
    expect(r.map((a) => a.id)).toContain("ev-pangyo-mobile");
  });

  it("마감 임박순: 고정 마감일 → 미정 → 상시·예산 소진 순", () => {
    const r = filterAnnouncements(ANNOUNCEMENTS, DEFAULT_QUERY, NOW);
    const firstRolling = r.findIndex((a) => a.applicationDeadline.type === "rolling" || a.applicationDeadline.type === "untilBudget");
    const lastFixed = r.findLastIndex((a) => a.applicationDeadline.type === "datetime" || a.applicationDeadline.type === "date");
    expect(lastFixed).toBeLessThan(firstRolling);
  });

  it("지도 범위 결과는 목록 결과 중 좌표가 있는 것과 같다", () => {
    const r = filterAnnouncements(ANNOUNCEMENTS, DEFAULT_QUERY, NOW);
    expect(withinBbox(r, null).length).toBe(r.filter(hasCoordinates).length);
    const guro = withinBbox(r, [126.89, 37.47, 126.91, 37.5]);
    expect(guro.map((a) => a.id)).toEqual(["ed-guro-backend"]);
  });

  it("이번 주 마감은 오늘~일요일 사이 고정 마감일만 센다", () => {
    const due = ANNOUNCEMENTS.filter((a) => isDueThisWeek(a, NOW)).map((a) => a.id);
    expect(due).toContain("hk-seongsu-climate"); // 10/23 날짜만 공지
    expect(due).not.toContain("hk-pangyo-ai"); // 10/26(월)
    expect(due).not.toContain("su-gyeonggi-early"); // 예산 소진 시
  });
});
