import { describe, expect, it } from "vitest";
import { applyDemoChanges } from "@/data/demo-changes";
import { timingFromAnnouncement } from "@/domain/calendar";
import { dueReminders, reminderFireAt, scheduleFor } from "@/domain/reminders";
import { seoulInstant } from "@/domain/time";
import type { Announcement, Timing } from "@/domain/types";
import { addEvent, applyDemoChange, deliverDueReminders, resolveEventChange, sendNextReminderNow } from "@/lib/personal-actions";
import { EMPTY_STATE, type PersonalState } from "@/lib/personal-store";
import { ANNOUNCEMENTS, NOW, TODAY, byId, testId } from "./fixtures";

const allDay: Timing = { type: "allDay", start: "2026-10-30", end: "2026-10-30", timeUnknown: true };
const timed: Timing = { type: "timed", start: seoulInstant("2026-10-30", "18:00"), end: null };

describe("알림 시각", () => {
  it("종일 일정은 N일 전 오전 9시(서울)", () => {
    expect(reminderFireAt(allDay, { type: "preset", days: 3 })).toBe(seoulInstant("2026-10-27", "09:00"));
    expect(reminderFireAt(allDay, { type: "preset", days: 0 })).toBe(seoulInstant("2026-10-30", "09:00"));
  });
  it("시각 일정은 N×24시간 전, 당일은 오전 9시", () => {
    expect(reminderFireAt(timed, { type: "preset", days: 1 })).toBe(seoulInstant("2026-10-29", "18:00"));
    expect(reminderFireAt(timed, { type: "preset", days: 0 })).toBe(seoulInstant("2026-10-30", "09:00"));
  });
  it("당일 9시보다 이른 일정은 1시간 전", () => {
    const early: Timing = { type: "timed", start: seoulInstant("2026-10-30", "08:00"), end: null };
    expect(reminderFireAt(early, { type: "preset", days: 0 })).toBe(seoulInstant("2026-10-30", "07:00"));
  });
  it("직접 설정은 지정한 날짜·시각", () => {
    expect(reminderFireAt(timed, { type: "custom", days: 2, time: "20:30" })).toBe(seoulInstant("2026-10-28", "20:30"));
  });
});

function withEvent(a: Announcement): { state: PersonalState; eventId: string } {
  const t = timingFromAnnouncement(a, "deadline");
  if (!t.available) throw new Error();
  const r = addEvent(
    { ...EMPTY_STATE, session: { kind: "demo", userId: "u", displayName: "d", startedAt: NOW } },
    {
      announcement: a,
      kind: "deadline",
      title: a.title,
      timing: t.timing,
      reminders: [
        { id: "r1", offset: { type: "preset", days: 1 }, channel: "inApp" },
        { id: "r0", offset: { type: "preset", days: 0 }, channel: "inApp" },
      ],
      memo: "",
    },
    NOW,
    testId,
  );
  if (!r.ok) throw new Error();
  return { state: r.state, eventId: r.event.id };
}

describe("알림 발송과 중복 방지", () => {
  it("도래한 알림은 한 번만 만든다", () => {
    const { state } = withEvent(byId("hk-pangyo-ai")); // 마감 10/26 18:00
    const at = seoulInstant("2026-10-25", "18:30");
    const once = deliverDueReminders(state, at, false, testId);
    expect(once.notifications).toHaveLength(1);
    const twice = deliverDueReminders(once, at, false, testId);
    expect(twice.notifications).toHaveLength(1);
  });

  it("데모로 미리 보낸 알림은 예약 시각에 다시 보내지 않는다", () => {
    const { state } = withEvent(byId("hk-pangyo-ai"));
    const { state: sent, sent: r } = sendNextReminderNow(state, NOW, false, testId);
    expect(r?.reminder.id).toBe("r1");
    const later = deliverDueReminders(sent, seoulInstant("2026-10-25", "18:30"), false, testId);
    expect(later.notifications).toHaveLength(1);
  });

  it("이메일 채널인데 제공자가 없으면 발송 실패로 기록한다", () => {
    const { state, eventId } = withEvent(byId("hk-pangyo-ai"));
    const emailState = { ...state, events: state.events.map((e) => (e.id === eventId ? { ...e, reminders: [{ id: "m", offset: { type: "preset" as const, days: 1 as const }, channel: "email" as const }] } : e)) };
    const n = deliverDueReminders(emailState, seoulInstant("2026-10-25", "18:30"), false, testId).notifications[0];
    expect(n.delivery).toBe("failed");
  });
});

describe("공고 변경 → 일정 갱신 → 알림 재계산", () => {
  it("마감이 바뀐 뒤 일정을 갱신하면 예전 시각 알림은 무효, 새 시각 기준으로 다시 예약된다", () => {
    const a = byId("hk-pangyo-ai");
    const { state, eventId } = withEvent(a);
    const oldKeys = scheduleFor(state.events[0]).map((s) => s.key);

    // 1) 변경 발생 → 연결된 공고라 변경 알림이 생긴다
    const map = (s: PersonalState) => new Map(applyDemoChanges(ANNOUNCEMENTS, s.appliedChanges, TODAY).map((x) => [x.id, x]));
    const changed = applyDemoChange(state, "demo-deadline-extend", NOW, map, testId);
    expect(changed.notifications.map((n) => n.type)).toEqual(["change"]);
    // 같은 변경은 두 번 적용·알림되지 않는다
    expect(applyDemoChange(changed, "demo-deadline-extend", NOW, map, testId)).toBe(changed);

    // 2) 사용자가 확인하고 갱신
    const updated = resolveEventChange(changed, eventId, map(changed).get(a.id)!, true, NOW);
    const event = updated.events[0];
    expect(event.timing).toEqual({ type: "timed", start: seoulInstant("2026-10-29", "18:00"), end: null });
    expect(event.sourceVersion).toBe(2);
    const newSchedule = scheduleFor(event);
    expect(newSchedule.map((s) => s.key).some((k) => oldKeys.includes(k))).toBe(false);
    expect(newSchedule[0].fireAt).toBe(seoulInstant("2026-10-28", "18:00"));

    // 3) 예전 마감 하루 전(10/25 18:30)에는 아무것도 보내지 않는다
    expect(dueReminders(updated.events, seoulInstant("2026-10-25", "18:30"), new Set())).toHaveLength(0);
    // 새 마감 하루 전에는 한 번 보낸다
    expect(dueReminders(updated.events, seoulInstant("2026-10-28", "18:30"), new Set())).toHaveLength(1);
  });
});
