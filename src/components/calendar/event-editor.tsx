"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { EVENT_KIND_LABEL } from "@/domain/calendar";
import { formatSeoulTime, seoulDateOf, seoulInstant } from "@/domain/time";
import type { CalendarEvent, Reminder, Timing } from "@/domain/types";
import { ReminderFields } from "./reminder-fields";

/** 일정 수정·삭제 */
export function EventEditor({
  event,
  onSave,
  onDelete,
  onClose,
}: {
  event: CalendarEvent;
  onSave: (patch: { title: string; timing: Timing; reminders: Reminder[]; memo: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = event.timing;
  const [title, setTitle] = useState(event.title);
  const [allDay, setAllDay] = useState(t.type === "allDay");
  const [startDate, setStartDate] = useState(t.type === "allDay" ? t.start : seoulDateOf(t.start));
  const [endDate, setEndDate] = useState(t.type === "allDay" ? t.end : t.end ? seoulDateOf(t.end) : seoulDateOf(t.start));
  const [startTime, setStartTime] = useState(t.type === "timed" ? formatSeoulTime(t.start) : "10:00");
  const [endTime, setEndTime] = useState(t.type === "timed" && t.end ? formatSeoulTime(t.end) : "");
  const [reminders, setReminders] = useState(event.reminders);
  const [memo, setMemo] = useState(event.memo);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timeUnknown = t.type === "allDay" && t.timeUnknown;

  const timing: Timing | null = (() => {
    if (!startDate) return null;
    if (allDay) {
      const end = endDate && endDate >= startDate ? endDate : startDate;
      return { type: "allDay", start: startDate, end, timeUnknown: timeUnknown && end === startDate };
    }
    const start = seoulInstant(startDate, startTime || "00:00");
    const end = endTime ? seoulInstant(endDate || startDate, endTime) : null;
    return { type: "timed", start, end: end && end > start ? end : null };
  })();
  const titleError = title.trim().length === 0 ? "일정 이름을 입력하세요." : null;
  const dateError = allDay && endDate && endDate < startDate ? "종료일이 시작일보다 빠를 수 없어요." : null;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="일정 수정"
      description={EVENT_KIND_LABEL[event.kind]}
      footer={
        confirmDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-danger">이 일정과 예약된 알림을 삭제할까요?</p>
            <div className="flex gap-2">
              <Button onClick={() => setConfirmDelete(false)}>취소</Button>
              <Button variant="danger" onClick={onDelete}>
                삭제
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              삭제
            </Button>
            <div className="flex gap-2">
              <Button onClick={onClose}>취소</Button>
              <Button
                variant="primary"
                disabled={!timing || Boolean(titleError) || Boolean(dateError)}
                onClick={() => timing && onSave({ title: title.trim(), timing, reminders, memo })}
              >
                저장
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4 p-4 text-[13px]">
        <label className="block">
          <span className="mb-1 block font-semibold">일정 이름</span>
          <input
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? "title-error" : undefined}
            className="h-10 w-full rounded-md border border-line bg-panel px-2 aria-[invalid=true]:border-danger"
          />
          {titleError ? (
            <span id="title-error" className="mt-1 block text-xs text-danger">
              {titleError}
            </span>
          ) : null}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          종일 일정
        </label>
        {timeUnknown && allDay ? <p className="text-xs text-warning">공고에 마감 시각이 없어 날짜만 등록된 일정이에요.</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block font-semibold">시작일</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="num h-10 w-full rounded-md border border-line bg-panel px-2" />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">종료일</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="num h-10 w-full rounded-md border border-line bg-panel px-2"
            />
          </label>
          {!allDay ? (
            <>
              <label className="block">
                <span className="mb-1 block font-semibold">시작 시각</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="num h-10 w-full rounded-md border border-line bg-panel px-2" />
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">
                  종료 시각 <span className="font-normal text-muted">(선택)</span>
                </span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="num h-10 w-full rounded-md border border-line bg-panel px-2" />
              </label>
            </>
          ) : null}
        </div>
        {dateError ? <p className="text-xs text-danger">{dateError}</p> : null}
        <label className="block">
          <span className="mb-1 block font-semibold">메모</span>
          <textarea value={memo} maxLength={500} rows={2} onChange={(e) => setMemo(e.target.value)} className="w-full rounded-md border border-line bg-panel px-2 py-1.5" />
        </label>
        <div className="border-t border-line pt-4">
          <ReminderFields timing={timing} value={reminders} onChange={setReminders} />
        </div>
      </div>
    </Sheet>
  );
}
