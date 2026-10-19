"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { useRequireLogin } from "@/components/auth/login-gate";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  defaultPrepDate,
  EVENT_KIND_LABEL,
  findDuplicate,
  formatTiming,
  timingFromAnnouncement,
} from "@/domain/calendar";
import { seoulInstant } from "@/domain/time";
import type { Announcement, EventKind, Reminder, Timing } from "@/domain/types";
import { newId, usePersonal } from "@/hooks/use-personal";
import { useNow, useToday } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { addEvent } from "@/lib/personal-actions";
import { readPersonalState, updatePersonalState } from "@/lib/personal-store";
import { defaultReminders, ReminderFields } from "./reminder-fields";

const STEPS = ["일정 종류", "날짜·시간 확인", "알림 설정"] as const;

/** 공고 상세의 '내 캘린더에 추가' → 종류 선택 → 날짜 확인 → 알림 → 저장 */
export function AddToCalendarButton({ a }: { a: Announcement }) {
  const requireLogin = useRequireLogin();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() =>
          requireLogin({
            reason: "내 캘린더는 계정에 저장돼요. 로그인하면 일정과 알림을 관리할 수 있어요.",
            onAuthorized: () => setOpen(true),
          })
        }
      >
        <CalendarPlus className="size-4 text-muted" aria-hidden />
        내 캘린더에 추가
      </Button>
      {open ? <AddEventDialog a={a} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AddEventDialog({ a, onClose }: { a: Announcement; onClose: () => void }) {
  const uid = useId();
  const now = useNow();
  const today = useToday();
  const toast = useToast();
  const { state } = usePersonal();
  const [step, setStep] = useState(0);
  const options = (["deadline", "event", "prep"] as EventKind[]).map((kind) => {
    const dup = findDuplicate(state.events, a.id, kind);
    const timing = kind === "prep" ? null : timingFromAnnouncement(a, kind);
    return { kind, dup, timing };
  });
  const firstAvailable = options.find((o) => !o.dup && (o.kind === "prep" || o.timing?.available))?.kind ?? "prep";
  const [kind, setKind] = useState<EventKind>(firstAvailable);
  const [prepDate, setPrepDate] = useState(defaultPrepDate(a, today));
  const [prepTime, setPrepTime] = useState("");
  const [title, setTitle] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>(defaultReminders);
  const [memo, setMemo] = useState("");

  const selected = options.find((o) => o.kind === kind)!;
  const timing: Timing | null =
    kind === "prep"
      ? prepTime
        ? { type: "timed", start: seoulInstant(prepDate, prepTime), end: null }
        : { type: "allDay", start: prepDate, end: prepDate, timeUnknown: false }
      : selected.timing?.available
        ? selected.timing.timing
        : null;
  const defaultTitle = kind === "prep" ? `${a.title} 준비` : `${a.title} ${EVENT_KIND_LABEL[kind]}`;
  const canNext = step === 0 ? !selected.dup && (kind === "prep" || selected.timing?.available) : step === 1 ? timing !== null : true;

  const save = () => {
    if (!timing) return;
    const result = addEvent(
      readPersonalState(),
      { announcement: a, kind, title: (title.trim() || defaultTitle).slice(0, 80), timing, reminders, memo },
      now,
      newId,
    );
    if (!result.ok) {
      toast({ message: "이미 같은 종류의 일정이 등록되어 있어요.", tone: "error" });
      return;
    }
    updatePersonalState(() => result.state);
    toast({ message: `내 캘린더에 ‘${EVENT_KIND_LABEL[kind]}’ 일정을 추가했어요.` });
    onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="내 캘린더에 추가"
      description={a.title}
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="num text-xs text-muted" aria-live="polite">
            {step + 1}/{STEPS.length} · {STEPS[step]}
          </p>
          <div className="flex gap-2">
            {step > 0 ? <Button onClick={() => setStep(step - 1)}>이전</Button> : <Button onClick={onClose}>취소</Button>}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                다음
              </Button>
            ) : (
              <Button variant="primary" onClick={save} disabled={!timing}>
                저장
              </Button>
            )}
          </div>
        </div>
      }
    >
      <ol className="flex border-b border-line px-4 text-xs" aria-label="진행 단계">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn("flex-1 border-b-2 py-2 text-center", i === step ? "border-accent font-semibold text-fg" : "border-transparent text-muted")}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="p-4">
        {step === 0 ? (
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">어떤 일정을 추가할까요?</legend>
            <div className="space-y-2">
              {options.map((o) => {
                const disabled = Boolean(o.dup) || (o.kind !== "prep" && !o.timing?.available);
                const id = `${uid}-${o.kind}`;
                return (
                  <label
                    key={o.kind}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-md border border-line px-3 py-2.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`${uid}-kind`}
                      className="mt-1 accent-[var(--accent)]"
                      checked={kind === o.kind}
                      disabled={disabled}
                      onChange={() => setKind(o.kind)}
                    />
                    <span className="min-w-0 text-[13px]">
                      <span className="block font-semibold">{EVENT_KIND_LABEL[o.kind]}</span>
                      <span className="block text-muted">
                        {o.dup
                          ? "이미 내 캘린더에 있어요."
                          : o.kind === "prep"
                            ? "지원서 작성, 서류 준비처럼 직접 정하는 일정"
                            : o.timing?.available
                              ? formatTiming(o.timing.timing)
                              : o.timing?.reason}
                      </span>
                      {o.dup ? (
                        <Link href={`/calendar?event=${o.dup.id}`} className="text-xs font-semibold text-accent-text hover:underline">
                          캘린더에서 보기
                        </Link>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4 text-[13px]">
            {kind === "prep" ? (
              <>
                <label className="block">
                  <span className="mb-1 block font-semibold">날짜</span>
                  <input
                    type="date"
                    required
                    value={prepDate}
                    min={today}
                    onChange={(e) => setPrepDate(e.target.value || prepDate)}
                    className="num h-10 w-full rounded-md border border-line bg-panel px-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-semibold">
                    시각 <span className="font-normal text-muted">(비우면 종일 일정)</span>
                  </span>
                  <input
                    type="time"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="num h-10 w-full rounded-md border border-line bg-panel px-2"
                  />
                </label>
              </>
            ) : (
              <div className="rounded-md bg-subtle px-3 py-2.5">
                <p className="text-xs text-muted">공고에 안내된 {EVENT_KIND_LABEL[kind]}</p>
                <p className="num mt-0.5 font-semibold">{timing ? formatTiming(timing) : "-"}</p>
                {timing?.type === "allDay" && timing.timeUnknown ? (
                  <p className="mt-1 text-xs text-warning">마감 시각이 공지되지 않아 날짜만 등록해요. 원문에서 시각을 꼭 확인하세요.</p>
                ) : null}
                <p className="mt-1 text-xs text-muted">공고가 바뀌면 일정에 ‘변경 확인 필요’가 표시돼요.</p>
              </div>
            )}
            <label className="block">
              <span className="mb-1 block font-semibold">일정 이름</span>
              <input
                value={title}
                maxLength={80}
                placeholder={defaultTitle}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-panel px-2 placeholder:text-faint"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold">메모</span>
              <textarea
                value={memo}
                maxLength={500}
                rows={2}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full rounded-md border border-line bg-panel px-2 py-1.5"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? <ReminderFields timing={timing} value={reminders} onChange={setReminders} /> : null}
      </div>
    </Sheet>
  );
}
