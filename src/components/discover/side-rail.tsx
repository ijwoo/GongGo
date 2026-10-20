"use client";

import { ArrowUpRight, Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { KakaoLoginButton, TestLoginButton } from "@/components/auth/kakao-login-button";
import { occursOn, sortEvents, timingStartDate, upcomingEvents } from "@/domain/calendar";
import { closingSoonList, mmdd, weekdayLabel, weekOf } from "@/domain/card";
import { formatSeoulTime, seoulDateOf, type LocalDate } from "@/domain/time";
import type { Announcement, CalendarEvent } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { useToday } from "@/lib/app-data";
import { announcementHref, markOpenedFromDiscover } from "@/lib/announcement-href";
import { cn } from "@/lib/cn";

function DateBlock({ date, active }: { date: LocalDate; active?: boolean }) {
  return (
    <span
      className={cn(
        "num flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border leading-tight",
        active ? "border-accent bg-accent text-accent-fg" : "border-line bg-panel text-fg",
      )}
    >
      <span className="text-lg font-bold">{Number(date.slice(8, 10))}</span>
      <span className={cn("text-xs", active ? "text-accent-fg/85" : "text-muted")}>{weekdayLabel(date)}</span>
    </span>
  );
}

/** 신청 마감이 확인된 접수 중 공고만, 마감이 가까운 순으로 3개 */
export function ClosingSoon({ list, now }: { list: Announcement[]; now: string }) {
  const items = closingSoonList(list, now, 3);
  return (
    <section aria-labelledby="closing-soon-title">
      <p className="mb-1 text-[13px] font-semibold text-accent-text">신청 마감 기준</p>
      <h2 id="closing-soon-title" className="mb-2 text-[20px] leading-tight font-bold tracking-[-0.01em]">
        곧 마감하는 공고
      </h2>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted">신청 마감일이 확인된 접수 중 공고가 없어요.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => {
            const d = a.applicationDeadline;
            const date = d.type === "datetime" ? seoulDateOf(d.at) : d.type === "date" ? d.date : "";
            const time = d.type === "datetime" ? `${formatSeoulTime(d.at)}까지` : "시각 미공지";
            return (
              <li key={a.id}>
                <Link
                  href={announcementHref(a.id)}
                  onClick={markOpenedFromDiscover}
                  className="group flex items-center gap-3.5 rounded-md py-3 focus-visible:outline-offset-1"
                >
                  <DateBlock date={date} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[15px] leading-snug font-semibold break-keep group-hover:text-accent-text">{a.title}</span>
                    <span className="num mt-0.5 block text-[13px] text-muted">
                      {mmdd(date)} · {time}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function timeText(e: CalendarEvent): string {
  if (e.timing.type === "timed") return formatSeoulTime(e.timing.start);
  return e.timing.timeUnknown ? "시각 미공지" : "종일";
}

/**
 * 내 일정. 이번 주(월~일, 서울 기준) 날짜 줄과, 고른 날의 일정 또는 가장 가까운 일정 2개.
 * 로그인하지 않았으면 남의 일정처럼 보이는 예시를 보여 주지 않고 로그인 안내를 한다.
 */
export function MySchedule() {
  const { state, hydrated, loggedIn } = usePersonal();
  const today = useToday();
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const selected = picked ?? today;
  const week = weekOf(today);
  const onDay = sortEvents(state.events.filter((e) => occursOn(e, selected)));
  const upcoming = upcomingEvents(state.events, today).slice(0, 2);
  const shown = onDay.length ? onDay.slice(0, 2) : upcoming;

  return (
    <section aria-labelledby="my-schedule-title" className="xl:border-t xl:border-line xl:pt-8">
      <p className="mb-1 text-[13px] font-semibold text-accent-text">이번 주</p>
      <div className="mb-4 flex items-center justify-between">
        <h2 id="my-schedule-title" className="text-[20px] leading-tight font-bold tracking-[-0.01em]">
          내 일정
        </h2>
        <Link href="/calendar" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-accent-text hover:underline">
          전체 보기
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {!hydrated ? (
        <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-subtle" />
      ) : !loggedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-2">로그인하면 저장한 공고의 신청 마감·행사 일정을 여기서 볼 수 있어요.</p>
          <KakaoLoginButton returnTo="/discover" />
          <TestLoginButton />
        </div>
      ) : (
        <>
          <div role="group" aria-label="이번 주 날짜" className="grid grid-cols-7 gap-1 text-center">
            {week.map((d) => {
              const active = d === selected;
              const has = state.events.some((e) => occursOn(e, d));
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 ${weekdayLabel(d)}요일${d === today ? ", 오늘" : ""}${has ? ", 일정 있음" : ""}`}
                  onClick={() => setPicked(d)}
                  className="flex flex-col items-center gap-1.5 rounded-md py-1 text-[13px] text-muted hover:text-fg"
                >
                  <span aria-hidden>{weekdayLabel(d)}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "num inline-flex size-9 items-center justify-center rounded-full text-[15px]",
                      active ? "bg-accent font-bold text-accent-fg" : d === today ? "font-bold text-fg ring-1 ring-accent" : "text-fg",
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </span>
                  <span aria-hidden className={cn("size-1 rounded-full", has ? "bg-accent" : "bg-transparent")} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            {shown.length === 0 ? (
              <div className="py-2 text-center text-sm text-muted">
                <p>관심 있는 공고를 일정에 추가해보세요.</p>
                <Link href="/calendar" className="mt-1 inline-block font-semibold text-accent-text hover:underline">
                  캘린더로 가기
                </Link>
              </div>
            ) : (
              <>
                {onDay.length === 0 ? <p className="mb-2 text-xs font-semibold text-muted">이날은 일정이 없어요 · 다가오는 일정</p> : null}
                <ul className="space-y-2">
                  {shown.map((e) => {
                    const date = timingStartDate(e.timing);
                    return (
                      <li key={e.id}>
                        <Link href={`/calendar?event=${e.id}`} className="group flex items-center gap-3 rounded-lg py-1.5 hover:bg-hover">
                          <DateBlock date={date} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold group-hover:text-accent-text">{e.title}</span>
                            <span className="num block text-[13px] text-muted">
                              {timeText(e)}
                              {e.reminders.length ? " · 알림 설정됨" : ""}
                            </span>
                          </span>
                          {e.reminders.length ? <Bell className="size-4 shrink-0 text-muted" aria-hidden /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
