"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EVENT_KIND_LABEL, timingStartDate, upcomingEvents } from "@/domain/calendar";
import { isDueThisWeek, isPublishedToday } from "@/domain/discover";
import { addLocalDays, formatLocalDateShort } from "@/domain/time";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow, useToday } from "@/lib/app-data";
import { changedSavedCount } from "@/lib/personal-actions";

function Item({ href, label, value, hint }: { href: string; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 shrink-0 items-baseline gap-2 rounded-sm px-1 py-0.5 hover:bg-subtle"
    >
      <span className="text-[13px] text-muted group-hover:text-fg">{label}</span>
      <span className="num text-[15px] font-bold text-fg">{value}</span>
      {hint ? <span className="truncate text-[13px] text-muted">{hint}</span> : null}
    </Link>
  );
}

/** 상단 요약. 모든 수치는 화면에 쓰는 같은 데이터에서 계산한다 */
export function SummaryStrip() {
  const { list, byId } = useAnnouncements();
  const now = useNow();
  const today = useToday();
  const { state, loggedIn, hydrated } = usePersonal();

  const todayCount = list.filter((a) => isPublishedToday(a, now)).length;
  const weekCount = list.filter((a) => isDueThisWeek(a, now)).length;
  const changed = changedSavedCount(state, byId);
  const weekEnd = addLocalDays(today, 7);
  const upcoming = upcomingEvents(state.events, today).filter((e) => timingStartDate(e.timing) <= weekEnd);
  const next = upcoming[0];

  return (
    <div className="border-b border-line bg-panel">
      <div className="mx-auto flex h-10 max-w-[1680px] items-center gap-4 overflow-x-auto px-4 [scrollbar-width:none] lg:gap-6">
        <h2 className="sr-only">오늘의 요약</h2>
        <Item href="/discover?quick=today" label="오늘 등록" value={`${todayCount}건`} />
        <span className="h-3 w-px shrink-0 bg-line" aria-hidden />
        <Item href="/discover?quick=week" label="이번 주 마감" value={`${weekCount}건`} />
        <span className="h-3 w-px shrink-0 bg-line" aria-hidden />
        {hydrated && loggedIn ? (
          <>
            <Item href="/saved?changed=1" label="관심 공고 변경" value={`${changed}건`} />
            <span className="h-3 w-px shrink-0 bg-line" aria-hidden />
            <Item
              href="/calendar"
              label="7일 내 내 일정"
              value={`${upcoming.length}건`}
              hint={
                next ? (
                  <>
                    · {formatLocalDateShort(timingStartDate(next.timing))} {EVENT_KIND_LABEL[next.kind]} {next.title}
                  </>
                ) : null
              }
            />
          </>
        ) : (
          <Item href="/saved" label="관심 공고 변경·내 일정" value="" hint="로그인 후 확인" />
        )}
        <p className="ml-auto shrink-0 pl-4 text-xs text-faint">공고·기관·장소는 데모용 예시입니다</p>
      </div>
    </div>
  );
}
