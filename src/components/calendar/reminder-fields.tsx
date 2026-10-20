"use client";

import { Plus, X } from "lucide-react";
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

/** 일정 알림 설정. 미리 정한 시점 + 직접 설정. 각 알림이 언제 울리는지 바로 보여 준다 */
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
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">알림 시점</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((d) => {
            const o: ReminderOffset = { type: "preset", days: d };
            const id = `${uid}-p${d}`;
            return (
              <label
                key={d}
                htmlFor={id}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-[13px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input id={id} type="checkbox" className="size-4 accent-[var(--accent)]" checked={has(o)} onChange={() => togglePreset(d)} />
                {offsetLabel(o)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">직접 설정</legend>
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
        <legend className="mb-2 text-[13px] font-semibold">받을 곳</legend>
        <div className="space-y-1.5 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled className="size-4" />
            앱 내 알림 <span className="text-muted">(기본)</span>
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={email && emailConfigured}
              disabled={!emailConfigured}
              onChange={(e) => setEmail(e.target.checked)}
              className="size-4"
              aria-describedby={`${uid}-email-hint`}
            />
            이메일
          </label>
          <p id={`${uid}-email-hint`} className="pl-6 text-xs text-faint">
            {emailConfigured
              ? "이메일 발송 제공자가 설정되어 있어요. 실제 발송 기능은 준비 중이에요."
              : "이메일 발송 제공자가 설정되지 않아 선택할 수 없어요."}
          </p>
        </div>
      </fieldset>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold">예약된 알림</p>
        {value.length === 0 ? (
          <p className="text-[13px] text-muted">알림 없음</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {value.map((r) => {
              const at = timing ? reminderFireAt(timing, r.offset) : null;
              const past = at !== null && at < now;
              return (
                <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                  <span className="w-24 shrink-0 font-medium">{offsetLabel(r.offset)}</span>
                  <span className="num flex-1 text-muted">
                    {at ? formatSeoulDateTime(at) : "날짜를 정하면 계산돼요"}
                    {past ? <span className="ml-1 text-warning">· 이미 지난 시점이라 보내지 않아요</span> : null}
                  </span>
                  <IconButton label={`${offsetLabel(r.offset)} 알림 삭제`} className="size-7" onClick={() => onChange(value.filter((x) => x.id !== r.id))}>
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-faint">
          알림 시각은 한국 시간 기준이에요. 종일 일정은 오전 9시에 알려요. 아직 서버 발송 기능이 없어서, 알림 시각이 지난 뒤 공고함을 열면 앱 내 알림으로 만들어져요.
        </p>
      </div>
    </div>
  );
}

export function defaultReminders(): Reminder[] {
  return [
    { id: newId(), offset: { type: "preset", days: 3 }, channel: "inApp" },
    { id: newId(), offset: { type: "preset", days: 1 }, channel: "inApp" },
  ];
}
