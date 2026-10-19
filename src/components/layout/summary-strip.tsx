"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { timingStartDate, upcomingEvents } from "@/domain/calendar";
import { isDueThisWeek, isPublishedToday } from "@/domain/discover";
import { addLocalDays, formatLocalDateShort } from "@/domain/time";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow, useToday } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { changedSavedCount } from "@/lib/personal-actions";

function Metric({
  href,
  label,
  value,
  hint,
  emphasis,
}: {
  href: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full min-w-0 shrink-0 items-center gap-2 border-r border-line px-4 first:pl-0 hover:bg-hover lg:px-5"
    >
      <span className="text-[13px] text-muted group-hover:text-fg-2">{label}</span>
      <span className={cn("num text-[15px] font-bold", emphasis ? "text-accent-text" : "text-fg")}>{value}</span>
      {hint ? <span className="max-w-72 truncate text-[13px] text-muted">{hint}</span> : null}
      <ChevronRight className="size-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
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
      <div className="flex h-11 w-full items-stretch overflow-x-auto px-4 [scrollbar-width:none] lg:px-6">
        <h2 className="sr-only">오늘의 요약</h2>
        <Metric href="/discover?quick=today" label="오늘 등록" value={`${todayCount}건`} />
        <Metric href="/discover?quick=week" label="이번 주 마감" value={`${weekCount}건`} emphasis={weekCount > 0} />
        {hydrated && loggedIn ? (
          <>
            <Metric href="/saved?changed=1" label="관심 공고 변경" value={`${changed}건`} emphasis={changed > 0} />
            <Metric
              href="/calendar"
              label="7일 내 내 일정"
              value={`${upcoming.length}건`}
              hint={next ? `${formatLocalDateShort(timingStartDate(next.timing))} ${next.title}` : null}
            />
          </>
        ) : (
          <Metric href="/saved" label="관심 공고 변경·내 일정" value="" hint="로그인 후 확인" />
        )}
        <p className="ml-auto flex shrink-0 items-center pl-4 text-xs text-faint">공고·기관·장소는 데모용 예시입니다</p>
      </div>
    </div>
  );
}
