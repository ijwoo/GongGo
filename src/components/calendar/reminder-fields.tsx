"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { offsetLabel, reminderFireAt } from "@/domain/reminders";
import { formatSeoulDateTime } from "@/domain/time";
import type { Reminder, ReminderOffset, Timing } from "@/domain/types";
import { newId } from "@/hooks/use-personal";
import { useEmailConfigured, useNow } from "@/lib/app-data";

const PRESETS: (7 | 3 | 1 | 0)[] = [7, 3, 1, 0];

function sameOffset(a: ReminderOffset, b: ReminderOffset) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 일정 알림 설정. 기본은 미리 정한 시점 선택과, 설정된 알림이 언제 울리는지의 요약.
 * 직접 시점 추가·받는 곳은 접어 둔다(접어도 요약은 항상 보인다).
 * 서버 예약 발송이 없으므로 ‘보내 드려요’가 아니라 ‘공고함을 열면 확인할 수 있어요’라고 쓴다.
 */
export function ReminderFields({
  timing,
  value,
  onChange,
}: {
  timing: Timing | null;
  value: Reminder[];
  onChange: (next: Reminder[]) => void;
}) {
  const uid = useId();
  const now = useNow();
  const emailConfigured = useEmailConfigured();
  const [customDays, setCustomDays] = useState(2);
  const [customTime, setCustomTime] = useState("20:00");
  const [email, setEmail] = useState(false);
  const channel = email && emailConfigured ? "email" : "inApp";
  const hasCustom = value.some((r) => r.offset.type === "custom");

  const has = (o: ReminderOffset) => value.some((r) => sameOffset(r.offset, o));
  const togglePreset = (days: 7 | 3 | 1 | 0) => {
    const o: ReminderOffset = { type: "preset", days };
    onChange(has(o) ? value.filter((r) => !sameOffset(r.offset, o)) : [...value, { id: newId(), offset: o, channel }]);
  };
  const addCustom = () => {
    const o: ReminderOffset = { type: "custom", days: customDays, time: customTime };
    if (!has(o)) onChange([...value, { id: newId(), offset: o, channel }]);
  };

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">알림</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((d) => {
            const o: ReminderOffset = { type: "preset", days: d };
            const id = `${uid}-p${d}`;
            return (
              <label
                key={d}
                htmlFor={id}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-[13px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]"
              >
                <input id={id} type="checkbox" className="size-4 accent-[var(--accent)]" checked={has(o)} onChange={() => togglePreset(d)} />
                {offsetLabel(o)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite">
        {value.length === 0 ? (
          <p className="text-[13px] text-muted">알림 없음</p>
        ) : (
          <ul className="divide-y divide-line rounded-md bg-subtle" aria-label="설정된 알림">
            {value.map((r) => {
              const at = timing ? reminderFireAt(timing, r.offset) : null;
              const past = at !== null && at < now;
              return (
                <li key={r.id} className="flex items-center gap-2 py-1 pr-1 pl-3 text-[13px]">
                  <span className="w-20 shrink-0 font-semibold">{offsetLabel(r.offset)}</span>
                  <span className="num min-w-0 flex-1 text-muted">
                    {at ? formatSeoulDateTime(at) : "날짜를 정하면 계산돼요"}
                    {past ? <span className="ml-1 text-warning">· 지난 시점이라 울리지 않아요</span> : null}
                    {r.channel === "email" ? <span className="ml-1">· 이메일</span> : null}
                  </span>
                  <IconButton label={`${offsetLabel(r.offset)} 알림 삭제`} className="size-7" onClick={() => onChange(value.filter((x) => x.id !== r.id))}>
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-muted">알림은 그 시각 뒤에 공고함을 열면 확인할 수 있어요. 종일 일정은 오전 9시 기준이에요.</p>
      </div>

      <details className="group rounded-md border border-line" open={hasCustom || undefined}>
        <summary className="flex h-9 cursor-pointer list-none items-center gap-1 px-3 text-[13px] font-semibold text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
          직접 설정
        </summary>
        <div className="space-y-4 border-t border-line px-3 py-3">
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">원하는 시점 추가</legend>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <label className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                  className="num h-9 w-16 rounded-md border border-line bg-panel px-2 text-right"
                  aria-label="며칠 전"
                />
                일 전
              </label>
              <label className="flex items-center gap-1.5">
                <span className="sr-only">알림 시각</span>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value || "09:00")}
                  className="num h-9 rounded-md border border-line bg-panel px-2"
                />
              </label>
              <button
                type="button"
                onClick={addCustom}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line-strong px-2.5 font-semibold hover:bg-subtle"
              >
                <Plus className="size-3.5" aria-hidden />
                추가
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold">받는 곳</legend>
            <p className="text-[13px] text-fg-2">공고함 알림함(기본)</p>
            <label className="mt-1.5 flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={email && emailConfigured}
                disabled={!emailConfigured}
                onChange={(e) => setEmail(e.target.checked)}
                className="size-4"
                aria-describedby={`${uid}-email-hint`}
              />
              이메일로도 받기
            </label>
            <p id={`${uid}-email-hint`} className="mt-0.5 pl-6 text-xs text-muted">
              {emailConfigured ? "이메일 발송은 준비 중이에요." : "이메일 알림은 아직 사용할 수 없어요."}
            </p>
          </fieldset>
        </div>
      </details>
    </div>
  );
}

export function defaultReminders(): Reminder[] {
  return [
    { id: newId(), offset: { type: "preset", days: 3 }, channel: "inApp" },
    { id: newId(), offset: { type: "preset", days: 1 }, channel: "inApp" },
  ];
}
