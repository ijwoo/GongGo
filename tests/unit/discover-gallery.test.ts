import { describe, expect, it } from "vitest";
import { applicationState } from "@/domain/announcement";
import { cardDeadline, cardEventLabel, closingSoonList, pickOpenNow, pickRecent, posterVariant, weekdayLabel, weekOf } from "@/domain/card";
import { filterAnnouncements, isCuratedQuery, isOnlineOnly, parseDiscoverQuery, serializeDiscoverQuery } from "@/domain/discover";
import type { Announcement } from "@/domain/types";
import { ANNOUNCEMENTS, NOW, byId } from "./fixtures";

describe("지역·온라인 포함", () => {
  it("지역을 고르면 그 지역 + 온라인 공고, 온라인을 끄면 지역 공고만", () => {
    const withOnline = filterAnnouncements(ANNOUNCEMENTS, parseDiscoverQuery({ region: "서울" }), NOW);
    const without = filterAnnouncements(ANNOUNCEMENTS, parseDiscoverQuery({ region: "서울", online: "0" }), NOW);
    expect(withOnline.some(isOnlineOnly)).toBe(true);
    expect(without.some(isOnlineOnly)).toBe(false);
    expect(withOnline.length - without.length).toBe(withOnline.filter(isOnlineOnly).length);
  });

  it("전국에서 온라인을 끄면 온라인 공고만 빠진다", () => {
    const all = filterAnnouncements(ANNOUNCEMENTS, parseDiscoverQuery({}), NOW);
    const offline = filterAnnouncements(ANNOUNCEMENTS, parseDiscoverQuery({ online: "0" }), NOW);
    expect(offline).toEqual(all.filter((a) => !isOnlineOnly(a)));
  });

  it("URL과 오간다(기본값은 주소에 남기지 않는다)", () => {
    const q = parseDiscoverQuery({ online: "0", all: "1", cat: "hackathon" });
    expect(serializeDiscoverQuery(q)).toBe("cat=hackathon&online=0&all=1");
    expect(serializeDiscoverQuery(parseDiscoverQuery({}))).toBe("");
  });

  it("검색어·세부 필터·전체 보기가 있으면 큐레이션 대신 결과 그리드", () => {
    expect(isCuratedQuery(parseDiscoverQuery({ cat: "event", region: "서울", online: "0" }))).toBe(true);
    for (const p of [{ q: "판교" }, { all: "1" }, { status: "open" }, { mode: "online" }, { closed: "1" }, { sort: "recent" }]) {
      expect(isCuratedQuery(parseDiscoverQuery(p)), JSON.stringify(p)).toBe(false);
    }
  });
});

describe("카드 날짜", () => {
  it("행사일과 신청 마감을 따로 쓴다", () => {
    const a = byId("hk-pangyo-ai");
    expect(cardEventLabel(a)).toBe("행사 11.09–11.10");
    expect(cardDeadline(a, NOW)).toEqual({ label: "마감 10.26", urgent: false });
  });

  it("마감 임박(3일 이내 접수 중)만 강조하고, 마감된 공고는 마감됨으로 쓴다", () => {
    const soon = ANNOUNCEMENTS.find((a) => applicationState(a, NOW) === "closingSoon")!;
    expect(cardDeadline(soon, NOW).urgent).toBe(true);
    const closed = ANNOUNCEMENTS.find((a) => applicationState(a, NOW) === "closed" && a.status === "active")!;
    expect(cardDeadline(closed, NOW).label).toMatch(/^마감됨 /);
    expect(cardDeadline(closed, NOW).urgent).toBe(false);
  });

  it("마감 정보가 없으면 지어내지 않는다", () => {
    const base = byId("hk-pangyo-ai");
    expect(cardDeadline({ ...base, applicationDeadline: { type: "tbd" } }, NOW).label).toBe("마감 미확인");
    expect(cardDeadline({ ...base, applicationDeadline: { type: "rolling" } }, NOW).label).toBe("상시 모집");
    expect(cardEventLabel({ ...base, event: { type: "tbd" } })).toBe("행사 일정 미정");
    // 행사가 없는 채용 공고에는 행사 일정을 쓰지 않는다
    expect(cardEventLabel({ ...base, category: "job", event: { type: "tbd" } })).toBeNull();
  });
});

describe("내 일정 주간 줄", () => {
  it("오늘이 속한 월~일을 서울 날짜로 계산하고 요일이 맞다", () => {
    expect(weekOf("2026-10-21")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(weekOf("2026-10-25")[0]).toBe("2026-10-19"); // 일요일은 그 주의 마지막 날
    expect(weekOf("2026-11-02")[0]).toBe("2026-11-02");
    expect(weekOf("2026-10-21").map(weekdayLabel)).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
  });
});

describe("곧 마감하는 공고", () => {
  it("접수 중이고 마감일이 확인된 공고만 마감이 가까운 순으로", () => {
    const items = closingSoonList(ANNOUNCEMENTS, NOW, 50);
    expect(items.length).toBeGreaterThan(0);
    for (const a of items) {
      expect(["open", "closingSoon"]).toContain(applicationState(a, NOW));
      expect(["datetime", "date"]).toContain(a.applicationDeadline.type);
    }
    const dates = items.map((a) => (a.applicationDeadline.type === "datetime" ? a.applicationDeadline.at : a.applicationDeadline.type === "date" ? a.applicationDeadline.date : ""));
    expect(dates.map((d) => d.slice(0, 10))).toEqual([...dates.map((d) => d.slice(0, 10))].sort());
  });
});

describe("큐레이션", () => {
  it("‘이번 주 눈여겨볼 기회’는 지금 신청할 수 있는 공고만, 행사가 가까운 순", () => {
    const picks = pickOpenNow(ANNOUNCEMENTS, NOW, 3);
    expect(picks).toHaveLength(3);
    for (const a of picks) expect(["open", "closingSoon", "rolling"]).toContain(applicationState(a, NOW));
  });

  it("‘새로 올라온 공고’는 앞 섹션과 겹치지 않는다", () => {
    const first = pickOpenNow(ANNOUNCEMENTS, NOW, 3);
    const recent = pickRecent(ANNOUNCEMENTS, new Set(first.map((a) => a.id)), 3);
    expect(recent.some((a) => first.includes(a))).toBe(false);
    expect(recent.map((a) => a.publishedAt)).toEqual([...recent.map((a) => a.publishedAt)].sort().reverse());
  });
});

describe("자체 표지", () => {
  it("같은 공고는 항상 같은 템플릿", () => {
    const ids = ANNOUNCEMENTS.map((a: Announcement) => a.id);
    expect(ids.map((id) => posterVariant(id))).toEqual(ids.map((id) => posterVariant(id)));
    expect(new Set(ids.map((id) => posterVariant(id))).size).toBeGreaterThan(2);
  });
});
