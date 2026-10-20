import { describe, expect, it } from "vitest";
import { agendaGroups, findDuplicate, formatTiming, monthGrid, nextEventAfter, pendingRevisions, proposedTiming, timingFromAnnouncement } from "@/domain/calendar";
import { addLocalDays, seoulInstant } from "@/domain/time";
import type { CalendarEvent } from "@/domain/types";
import { applyFixtureChanges } from "../fixtures/changes";
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
    const changed = applyFixtureChanges(ANNOUNCEMENTS, [{ id: "demo-deadline-extend", appliedAt: NOW }], TODAY);
    const a = changed.find((x) => x.id === "hk-pangyo-ai")!;
    expect(a.contentVersion).toBe(2);
    expect(pendingRevisions(e, a)).toHaveLength(1);
    expect(proposedTiming(e, a)).toEqual({ type: "timed", start: seoulInstant("2026-10-29", "18:00"), end: null });
  });

  it("관계없는 변경(행사 일정에 서류 변경)은 확인 대상이 아니다", () => {
    const e = eventFrom("su-gwanak-student", "event");
    const changed = applyFixtureChanges(ANNOUNCEMENTS, [{ id: "demo-docs-added", appliedAt: NOW }], TODAY);
    expect(pendingRevisions(e, changed.find((x) => x.id === "su-gwanak-student"))).toHaveLength(0);
  });
});

describe("일정 목록 보기", () => {
  function allDay(id: string, start: string, end = start): CalendarEvent {
    return { id, announcementId: null, kind: "prep", title: id, timing: { type: "allDay", start, end, timeUnknown: false }, sourceVersion: null, reminders: [], memo: "", createdAt: NOW, updatedAt: NOW };
  }

  it("오늘부터 날짜별로 묶고, 진행 중인 여러 날 일정은 오늘 아래에 둔다", () => {
    const events = [
      allDay("past", addLocalDays(TODAY, -3)),
      allDay("ongoing", addLocalDays(TODAY, -1), addLocalDays(TODAY, 1)),
      allDay("later", addLocalDays(TODAY, 4)),
      allDay("today", TODAY),
    ];
    expect(agendaGroups(events, TODAY).map((g) => [g.date, g.events.map((e) => e.id)])).toEqual([
      [TODAY, ["ongoing", "today"]],
      [addLocalDays(TODAY, 4), ["later"]],
    ]);
  });

  it("일정 없는 날에서 다음 일정으로 갈 수 있다", () => {
    const events = [allDay("a", addLocalDays(TODAY, 2)), allDay("b", addLocalDays(TODAY, 9))];
    expect(nextEventAfter(events, addLocalDays(TODAY, 3))?.id).toBe("b");
    expect(nextEventAfter(events, addLocalDays(TODAY, 9))).toBeNull();
  });
});
