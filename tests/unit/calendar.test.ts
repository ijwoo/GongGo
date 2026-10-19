import { describe, expect, it } from "vitest";
import { findDuplicate, formatTiming, monthGrid, pendingRevisions, proposedTiming, timingFromAnnouncement } from "@/domain/calendar";
import { addLocalDays, seoulInstant } from "@/domain/time";
import type { CalendarEvent } from "@/domain/types";
import { applyDemoChanges } from "@/data/demo-changes";
import { ANNOUNCEMENTS, NOW, TODAY, byId } from "./fixtures";

function eventFrom(id: string, kind: "deadline" | "event"): CalendarEvent {
  const a = byId(id);
  const t = timingFromAnnouncement(a, kind);
  if (!t.available) throw new Error("no timing");
  return { id: `e-${id}`, announcementId: id, kind, title: a.title, timing: t.timing, sourceVersion: a.contentVersion, reminders: [], memo: "", createdAt: NOW, updatedAt: NOW };
}

describe("공고 → 일정 변환", () => {
  it("마감 시각이 없으면 종일·시각 미공지로 만들고 23:59를 지어내지 않는다", () => {
    const t = timingFromAnnouncement(byId("hk-seongsu-climate"), "deadline");
    expect(t).toEqual({ available: true, timing: { type: "allDay", start: "2026-10-23", end: "2026-10-23", timeUnknown: true } });
    expect(formatTiming((t as { timing: CalendarEvent["timing"] }).timing)).toContain("시각 미공지");
    expect(formatTiming((t as { timing: CalendarEvent["timing"] }).timing)).not.toContain("23:59");
  });

  it("상시 모집·예산 소진 시는 고정 마감일로 바꾸지 않는다", () => {
    expect(timingFromAnnouncement(byId("su-rolling-mentoring"), "deadline").available).toBe(false);
    expect(timingFromAnnouncement(byId("su-gyeonggi-early"), "deadline").available).toBe(false);
  });

  it("복수일 행사는 시작일·종료일을 유지한다", () => {
    const t = timingFromAnnouncement(byId("hk-pangyo-ai"), "event");
    expect(t).toEqual({ available: true, timing: { type: "allDay", start: addLocalDays(TODAY, 19), end: addLocalDays(TODAY, 20), timeUnknown: false } });
  });

  it("시각이 있는 마감은 UTC 시점으로 저장한다", () => {
    const t = timingFromAnnouncement(byId("hk-pangyo-ai"), "deadline");
    expect(t).toEqual({ available: true, timing: { type: "timed", start: seoulInstant(addLocalDays(TODAY, 5), "18:00"), end: null } });
    expect(seoulInstant("2026-10-26", "18:00")).toBe("2026-10-26T09:00:00.000Z");
  });

  it("같은 공고의 같은 종류 일정은 중복 등록을 막는다", () => {
    const e = eventFrom("hk-pangyo-ai", "deadline");
    expect(findDuplicate([e], "hk-pangyo-ai", "deadline")).toBe(e);
    expect(findDuplicate([e], "hk-pangyo-ai", "event")).toBeNull();
    expect(findDuplicate([e], "hk-pangyo-ai", "prep")).toBeNull();
  });

  it("월간 달력은 일요일부터 6주", () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-09-27");
    expect(g).toContain("2026-10-31");
  });
});

describe("공고 변경 확인", () => {
  it("마감이 바뀌면 일정에 확인 필요가 생기고, 새 시각을 제안한다", () => {
    const e = eventFrom("hk-pangyo-ai", "deadline");
    const changed = applyDemoChanges(ANNOUNCEMENTS, [{ id: "demo-deadline-extend", appliedAt: NOW }], TODAY);
    const a = changed.find((x) => x.id === "hk-pangyo-ai")!;
    expect(a.contentVersion).toBe(2);
    expect(pendingRevisions(e, a)).toHaveLength(1);
    expect(proposedTiming(e, a)).toEqual({ type: "timed", start: seoulInstant("2026-10-29", "18:00"), end: null });
  });

  it("관계없는 변경(행사 일정에 서류 변경)은 확인 대상이 아니다", () => {
    const e = eventFrom("su-gwanak-student", "event");
    const changed = applyDemoChanges(ANNOUNCEMENTS, [{ id: "demo-docs-added", appliedAt: NOW }], TODAY);
    expect(pendingRevisions(e, changed.find((x) => x.id === "su-gwanak-student"))).toHaveLength(0);
  });
});
