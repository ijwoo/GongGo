import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/domain/ics";
import { seoulInstant } from "@/domain/time";
import type { CalendarEvent } from "@/domain/types";
import { ANNOUNCEMENTS, NOW } from "./fixtures";

const base = { reminders: [] as CalendarEvent["reminders"], memo: "", createdAt: NOW, updatedAt: NOW, sourceVersion: null, announcementId: null };
const allDay: CalendarEvent = { ...base, id: "a1", kind: "event", title: "해커톤, 본선; 1일차", timing: { type: "allDay", start: "2026-11-09", end: "2026-11-10", timeUnknown: false } };
const deadline: CalendarEvent = {
  ...base,
  id: "d1",
  kind: "deadline",
  announcementId: "hk-pangyo-ai",
  title: "마감",
  memo: "첫 줄\n둘째 줄",
  timing: { type: "timed", start: seoulInstant("2026-10-26", "18:00"), end: null },
};
const ics = buildIcs([allDay, deadline], { nowIso: NOW, announcements: new Map(ANNOUNCEMENTS.map((a) => [a.id, a])) });

describe(".ics 내보내기", () => {
  it("CRLF 줄바꿈과 필수 속성", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(ics).toContain("UID:a1@gonggoham.app");
    expect(ics).toContain("DTSTAMP:20261021T010000Z");
  });

  it("종일 일정은 VALUE=DATE, DTEND는 마지막 날 다음 날", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261109");
    expect(ics).toContain("DTEND;VALUE=DATE:20261111");
  });

  it("시각 일정은 UTC로 쓴다", () => {
    expect(ics).toContain("DTSTART:20261026T090000Z");
  });

  it("텍스트 이스케이프", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(ics).toContain("SUMMARY:해커톤\\, 본선\\; 1일차");
  });

  it("75옥텟을 넘는 줄은 접고, 한글을 중간에서 자르지 않는다", () => {
    const long = `DESCRIPTION:${"가".repeat(60)}`;
    const folded = foldLine(long);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    expect(enc.encode(parts[0]).length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(" ")).toBe(true);
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(long);
    for (const line of ics.split("\r\n")) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
  });
});
