import { timingKey, timingStartDate } from "./calendar";
import { addLocalDays, seoulDateOf, seoulInstant } from "./time";
import type { CalendarEvent, Reminder, ReminderOffset, Timing } from "./types";

/**
 * 알림 시각 정책 (Asia/Seoul)
 * - 종일 일정: (시작일 - N일) 오전 9시. 직접 설정은 지정한 시각.
 * - 시각이 있는 일정: 시작 시각 - N×24시간.
 *   '당일'은 그날 오전 9시이며, 일정이 9시 이전이면 시작 1시간 전.
 * - 일정을 만들거나 고친 시점보다 이미 지난 알림은 보내지 않는다(skipped).
 */
export const DEFAULT_REMINDER_TIME = "09:00";

export function offsetLabel(o: ReminderOffset): string {
  if (o.type === "preset") return o.days === 0 ? "당일" : `${o.days}일 전`;
  return o.days === 0 ? `당일 ${o.time}` : `${o.days}일 전 ${o.time}`;
}

export function reminderFireAt(timing: Timing, offset: ReminderOffset): string {
  if (offset.type === "custom") {
    return seoulInstant(addLocalDays(timingStartDate(timing), -offset.days), offset.time);
  }
  if (timing.type === "allDay") {
    return seoulInstant(addLocalDays(timing.start, -offset.days), DEFAULT_REMINDER_TIME);
  }
  if (offset.days === 0) {
    const nineAm = seoulInstant(seoulDateOf(timing.start), DEFAULT_REMINDER_TIME);
    return nineAm < timing.start ? nineAm : new Date(Date.parse(timing.start) - 60 * 60 * 1000).toISOString();
  }
  return new Date(Date.parse(timing.start) - offset.days * 24 * 60 * 60 * 1000).toISOString();
}

export interface ScheduledReminder {
  eventId: string;
  reminder: Reminder;
  fireAt: string;
  /** 일정·알림 설정·시각이 같을 때만 같은 키 → 시각이 바뀌면 이전 예약은 자동으로 무효 */
  key: string;
  state: "scheduled" | "skipped";
}

export function scheduleFor(event: CalendarEvent): ScheduledReminder[] {
  return event.reminders.map((r) => {
    const fireAt = reminderFireAt(event.timing, r.offset);
    return {
      eventId: event.id,
      reminder: r,
      fireAt,
      key: `${event.id}:${r.id}:${r.channel}:${timingKey(event.timing)}`,
      state: fireAt < event.updatedAt ? "skipped" : "scheduled",
    };
  });
}

/** 지금 보내야 하는 알림. 이미 보낸 키는 제외한다 */
export function dueReminders(events: CalendarEvent[], nowIso: string, sentKeys: ReadonlySet<string>): ScheduledReminder[] {
  return events
    .flatMap(scheduleFor)
    .filter((s) => s.state === "scheduled" && s.fireAt <= nowIso && !sentKeys.has(s.key))
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/** 다음에 보낼 알림(미리보기용) */
export function nextReminders(events: CalendarEvent[], nowIso: string, sentKeys: ReadonlySet<string>, limit = 5): ScheduledReminder[] {
  return events
    .flatMap(scheduleFor)
    .filter((s) => s.state === "scheduled" && s.fireAt > nowIso && !sentKeys.has(s.key))
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt))
    .slice(0, limit);
}
