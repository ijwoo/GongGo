import { describe, expect, it } from "vitest";
import { buildFixtureAnnouncements } from "../fixtures/announcements";
import { announcementSchema } from "@/domain/types";
import { applicationState } from "@/domain/announcement";
import { ANNOUNCEMENTS, NOW, TODAY } from "./fixtures";

describe("데모 데이터", () => {
  it("스키마를 통과하고 30개 이상이다", () => {
    expect(() => announcementSchema.array().parse(ANNOUNCEMENTS)).not.toThrow();
    expect(ANNOUNCEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it("같은 기준일이면 항상 같은 결과(서버·브라우저 hydration 일치)", () => {
    expect(buildFixtureAnnouncements(TODAY)).toEqual(buildFixtureAnnouncements(TODAY));
  });

  it("요구한 경우를 모두 포함한다", () => {
    const states = new Set(ANNOUNCEMENTS.map((a) => applicationState(a, NOW)));
    for (const s of ["open", "upcoming", "closed", "rolling", "cancelled"]) expect(states).toContain(s);
    expect(ANNOUNCEMENTS.some((a) => a.venue.status === "tbd")).toBe(true);
    expect(ANNOUNCEMENTS.some((a) => a.venue.status === "online")).toBe(true);
    expect(ANNOUNCEMENTS.some((a) => a.participationMode === "hybrid")).toBe(true);
    expect(ANNOUNCEMENTS.some((a) => a.applicationDeadline.type === "date")).toBe(true);
    expect(ANNOUNCEMENTS.some((a) => a.applicationDeadline.type === "untilBudget")).toBe(true);
    expect(ANNOUNCEMENTS.some((a) => a.revisions.length > 0)).toBe(true);
    const venues = ANNOUNCEMENTS.filter((a) => a.venue.status === "confirmed").map((a) => a.venue.status === "confirmed" && a.venue.name);
    expect(venues.length - new Set(venues).size).toBeGreaterThan(0); // 같은 장소 여러 공고
  });

  it("장소 미정·온라인 공고에는 좌표가 없다", () => {
    for (const a of ANNOUNCEMENTS) {
      if (a.venue.status !== "confirmed") expect("coordinates" in a.venue).toBe(false);
    }
  });
});
