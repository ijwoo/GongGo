"use client";

import { AlertTriangle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Download, List as ListIcon, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { LoginRequired } from "@/components/auth/login-required";
import { EventEditor } from "@/components/calendar/event-editor";
import { KindTag } from "@/components/calendar/event-kind";
import { EmptyState, PageFrame, PageHeader } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass, IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  agendaGroups,
  EVENT_KIND_LABEL,
  formatTiming,
  monthGrid,
  nextEventAfter,
  occursOn,
  pendingRevisions,
  proposedTiming,
  sortEvents,
  timingStartDate,
  upcomingEvents,
} from "@/domain/calendar";
import { buildIcs } from "@/domain/ics";
import { offsetLabel } from "@/domain/reminders";
import { addLocalDays, formatLocalDate, formatLocalDateShort, formatMonth, localDaysBetween } from "@/domain/time";
import { EVENT_KINDS, type CalendarEvent, type EventKind } from "@/domain/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow, useToday } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { deleteEvent, eventsNeedingReview, resolveEventChange, updateEvent } from "@/lib/personal-actions";
import { announcementHref } from "@/lib/announcement-href";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

type CalendarMode = "month" | "list";

/** 일정 종류 점 색. 글자 라벨과 함께 쓴다 */
const KIND_DOT: Record<EventKind, string> = { deadline: "bg-danger", event: "bg-accent", prep: "bg-success" };

export function CalendarView() {
  return (
    <PageFrame>
      <LoginRequired reason="내 캘린더는 계정에 저장돼요.">
        <CalendarBody />
      </LoginRequired>
    </PageFrame>
  );
}

/** 캘린더 화면의 보기 상태(월·선택 날짜·종류 필터·수정 중인 일정)는 URL에 둔다 */
function useCalendarParams(today: string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : today.slice(0, 7);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : today;
  const kindsParam = params.get("kinds");
  const kinds = kindsParam ? (kindsParam.split(",").filter((k) => (EVENT_KINDS as readonly string[]).includes(k)) as EventKind[]) : [...EVENT_KINDS];
  const editing = params.get("event");
  const viewParam = params.get("view");
  const view: CalendarMode | null = viewParam === "list" || viewParam === "month" ? viewParam : null;
  const set = (patch: Record<string, string | null>, mode: "push" | "replace" = "replace") => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const href = `${pathname}${next.size ? `?${next}` : ""}`;
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };
  return { month, date, kinds, editing, view, set };
}

function CalendarBody() {
  const today = useToday();
  const now = useNow();
  const toast = useToast();
  const { state, update } = usePersonal();
  const { byId } = useAnnouncements();
  const { month, date, kinds, editing, view: viewParam, set } = useCalendarParams(today);
  // 보기를 고르지 않았으면 넓은 화면은 월간, 휴대폰은 일정 목록
  const md = useMediaQuery("(min-width: 768px)");
  const view: CalendarMode = viewParam ?? (md ? "month" : "list");
  const [year, month1] = month.split("-").map(Number);
  const days = monthGrid(year, month1);
  const events = state.events.filter((e) => kinds.includes(e.kind));
  const review = eventsNeedingReview(state, byId);
  const editingEvent = editing ? state.events.find((e) => e.id === editing) : undefined;
  const gridRef = useRef<HTMLDivElement>(null);

  const moveMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month1 - 1 + delta, 1, 12));
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    set({ month: m, date: `${m}-01` }, "push");
  };

  const selectDate = (d: string, focus = false) => {
    set({ date: d, month: d.slice(0, 7) });
    if (focus) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${d}"]`)?.focus());
  };

  // 날짜 칸 사이를 방향키로 움직인다(로빙 tabindex)
  const onGridKey = (e: KeyboardEvent) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    selectDate(addLocalDays(date, delta), true);
  };

  const exportIcs = () => {
    const target = sortEvents(events);
    if (target.length === 0) {
      toast({ message: "내보낼 일정이 없어요.", tone: "error" });
      return;
    }
    const ics = buildIcs(target, { nowIso: now, announcements: byId });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gonggoham-${today}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ message: `일정 ${target.length}개를 .ics 파일로 내려받았어요. 이후 바뀐 일정은 다시 내려받아야 해요.` });
  };

  const toggleKind = (k: EventKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    set({ kinds: next.length === EVENT_KINDS.length ? null : next.join(",") || "none" });
  };

  const edit = (id: string) => set({ event: id }, "push");
  const dayEvents = sortEvents(events.filter((e) => occursOn(e, date)));
  // 고른 날짜에 이미 보이는 일정은 ‘다가오는 일정’에서 다시 보여 주지 않는다
  const shownIds = new Set(dayEvents.map((e) => e.id));
  const upcoming = upcomingEvents(events, today)
    .filter((e) => !shownIds.has(e.id))
    .slice(0, 6);
  const next = dayEvents.length === 0 ? nextEventAfter(events, date) : null;
  const noEvents = events.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <PageHeader
        title="내 캘린더"
        description="직접 추가한 신청 마감·행사·준비 일정이에요. 시간은 한국 시간 기준이에요."
        actions={
          <Button size="sm" onClick={exportIcs} title="한 번 내려받는 파일이라, 이후 바뀐 일정은 다시 내려받아야 해요.">
            <Download className="size-4" aria-hidden />
            .ics 내보내기
          </Button>
        }
      />

      {review.length > 0 ? (
        <section aria-labelledby="review-title" className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-4">
          <h2 id="review-title" className="mb-2 flex items-center gap-1.5 text-sm font-bold text-warning">
            <AlertTriangle className="size-4" aria-hidden />
            변경 확인 필요 {review.length}건
          </h2>
          <ul className="space-y-3">
            {review.map(({ event, revisions }) => {
              const a = byId.get(event.announcementId!)!;
              const proposed = proposedTiming(event, a);
              return (
                <li key={event.id} className="rounded-md bg-panel p-3 text-[13px]">
                  <p className="font-semibold">
                    <KindTag kind={event.kind} className="mr-1.5" />
                    {event.title}
                  </p>
                  {revisions.map((r) => (
                    <p key={r.id} className="mt-1">
                      {r.summary} <span className="text-muted line-through">{r.before}</span> → <b>{r.after}</b>
                    </p>
                  ))}
                  <p className="num mt-1 text-xs text-muted">
                    내 일정: {formatTiming(event.timing)}
                    {proposed ? ` → 바뀔 일정: ${formatTiming(proposed)}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {proposed ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          update((s) => resolveEventChange(s, event.id, a, true, now));
                          toast({ message: "일정을 바뀐 날짜로 갱신하고 알림을 다시 계산했어요." });
                        }}
                      >
                        변경 내용으로 갱신
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() => {
                        update((s) => resolveEventChange(s, event.id, a, false, now));
                        toast({ message: proposed ? "기존 일정을 유지했어요." : "확인했어요." });
                      }}
                    >
                      {proposed ? "기존 일정 유지" : "확인"}
                    </Button>
                    <Link href={announcementHref(a.id)} className={buttonClass("ghost", "sm")}>
                      공고 보기
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div role="radiogroup" aria-label="보기" className="inline-flex rounded-md border border-line-strong p-0.5">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => set({ view: v })}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-semibold",
                view === v ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              {v === "month" ? <CalendarDays className="size-4" aria-hidden /> : <ListIcon className="size-4" aria-hidden />}
              {v === "month" ? "월간" : "일정 목록"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="일정 종류" className="flex flex-wrap items-center gap-1.5">
          {EVENT_KINDS.map((k) => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors",
                  on ? "border-line-strong bg-panel text-fg" : "border-dashed border-line-strong text-muted line-through decoration-1",
                )}
              >
                <span aria-hidden className={cn("size-2 rounded-full", on ? KIND_DOT[k] : "bg-line-strong")} />
                {EVENT_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </div>

      {view === "list" ? (
        <section aria-labelledby="agenda-title" className="max-w-[760px]">
          <h2 id="agenda-title" className="sr-only">
            다가오는 일정 목록
          </h2>
          <Agenda events={events} today={today} byId={byId} onEdit={edit} emptyAll={noEvents} />
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-labelledby="month-title" className="min-w-0 rounded-lg border border-line bg-panel">
            <div className="flex items-center gap-1 border-b border-line px-3 py-2">
              <IconButton label="이전 달" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </IconButton>
              <h2 id="month-title" className="num min-w-28 text-center text-[17px] font-bold" aria-live="polite">
                {formatMonth(year, month1)}
              </h2>
              <IconButton label="다음 달" onClick={() => moveMonth(1)}>
                <ChevronRight className="size-4" aria-hidden />
              </IconButton>
              <Button size="sm" className="ml-1" onClick={() => selectDate(today)}>
                오늘
              </Button>
            </div>
            <div ref={gridRef} role="grid" aria-labelledby="month-title" onKeyDown={onGridKey} className="p-2">
              <div role="row" className="grid grid-cols-7 text-center text-xs text-muted">
                {WEEK.map((w, i) => (
                  <span key={w} role="columnheader" className={cn("py-1.5", i === 0 && "text-danger")}>
                    {w}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, row) => (
                <div role="row" key={row} className="grid grid-cols-7 border-t border-line">
                  {days.slice(row * 7, row * 7 + 7).map((d) => {
                    const inMonth = d.slice(0, 7) === month;
                    const list = sortEvents(events.filter((e) => occursOn(e, d)));
                    const selected = d === date;
                    const isToday = d === today;
                    return (
                      <div role="gridcell" key={d} aria-selected={selected} className="min-w-0 border-l border-line first:border-l-0">
                        <button
                          type="button"
                          data-date={d}
                          tabIndex={selected ? 0 : -1}
                          onClick={() => selectDate(d)}
                          aria-label={`${formatLocalDate(d)}${isToday ? ", 오늘" : ""}, 일정 ${list.length}개`}
                          className={cn(
                            "flex h-16 w-full flex-col items-stretch gap-0.5 p-1 text-left transition-colors sm:h-20 xl:h-[88px]",
                            // 선택한 날은 테두리, 오늘은 숫자 원으로 서로 다르게 보인다
                            selected ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]" : "hover:bg-subtle",
                            !inMonth && "opacity-45",
                          )}
                        >
                          <span
                            className={cn(
                              "num inline-flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold",
                              isToday && "bg-accent text-accent-fg",
                            )}
                          >
                            {Number(d.slice(8))}
                          </span>
                          {list.slice(0, 2).map((e) => (
                            <span key={e.id} className="flex min-w-0 items-center gap-1 text-[11px] leading-tight">
                              <KindTag kind={e.kind} className="h-4 px-0.5 text-[10px]" />
                              <span className="hidden truncate md:inline">{e.title}</span>
                            </span>
                          ))}
                          {list.length > 2 ? <span className="num text-[11px] text-muted">+{list.length - 2}</span> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <div className="min-w-0 space-y-6">
            <section aria-labelledby="day-title">
              <h2 id="day-title" className="mb-2 flex items-baseline gap-2 text-[17px] font-bold">
                {formatLocalDate(date)}
                {date === today ? <span className="text-[13px] font-semibold text-accent-text">오늘</span> : null}
              </h2>
              {dayEvents.length === 0 ? (
                <div className="rounded-lg bg-subtle px-4 py-4 text-[13px] text-muted">
                  <p>이날은 일정이 없어요.</p>
                  {next ? (
                    <button
                      type="button"
                      onClick={() => selectDate(timingStartDate(next.timing))}
                      className="mt-1.5 inline-flex items-center gap-1 text-left font-semibold text-accent-text hover:underline"
                    >
                      다음 일정 {formatLocalDateShort(timingStartDate(next.timing))} · {next.title}
                      <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : (
                <EventList items={dayEvents} onEdit={edit} byId={byId} />
              )}
            </section>
            <section aria-labelledby="upcoming-title">
              <h2 id="upcoming-title" className="mb-2 text-[17px] font-bold">
                다가오는 일정
              </h2>
              {noEvents ? (
                <EmptyState
                  icon={<CalendarDays className="size-6 text-faint" aria-hidden />}
                  title="아직 일정이 없어요"
                  description="공고 상세에서 ‘내 캘린더에 추가’를 눌러 보세요."
                  action={
                    <Link href="/discover" className={buttonClass("primary", "sm")}>
                      공고 둘러보기
                    </Link>
                  }
                />
              ) : upcoming.length === 0 ? (
                <p className="text-[13px] text-muted">{dayEvents.length ? "이 밖에 다가오는 일정은 없어요." : "다가오는 일정이 없어요."}</p>
              ) : (
                <EventList items={upcoming} onEdit={edit} byId={byId} showDate />
              )}
            </section>
          </div>
        </div>
      )}

      {editingEvent ? (
        <EventEditor
          key={editingEvent.id}
          event={editingEvent}
          onClose={() => set({ event: null })}
          onSave={(patch) => {
            update((s) => updateEvent(s, editingEvent.id, patch, now));
            set({ event: null });
            toast({ message: "일정을 저장했어요. 알림 시각도 다시 계산했어요." });
          }}
          onDelete={() => {
            const removed = editingEvent;
            update((s) => deleteEvent(s, removed.id));
            set({ event: null });
            toast({ message: "일정을 삭제했어요.", action: { label: "되돌리기", onClick: () => update((s) => ({ ...s, events: [...s.events, removed] })) } });
          }}
        />
      ) : null}
    </div>
  );
}

/** 일정 목록 보기: 오늘부터 날짜별로 묶어 읽기 쉽게 */
function Agenda({
  events,
  today,
  byId,
  onEdit,
  emptyAll,
}: {
  events: CalendarEvent[];
  today: string;
  byId: ReturnType<typeof useAnnouncements>["byId"];
  onEdit: (id: string) => void;
  emptyAll: boolean;
}) {
  const groups = agendaGroups(events, today);
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-6 text-faint" aria-hidden />}
        title={emptyAll ? "아직 일정이 없어요" : "다가오는 일정이 없어요"}
        description="공고 상세에서 ‘내 캘린더에 추가’를 눌러 보세요."
        action={
          <Link href="/discover" className={buttonClass("primary", "sm")}>
            공고 둘러보기
          </Link>
        }
      />
    );
  }
  return (
    <ol className="space-y-6">
      {groups.map((g) => {
        const days = localDaysBetween(today, g.date);
        return (
          <li key={g.date}>
            <h3 className="mb-1 flex items-baseline gap-2 border-b border-line pb-2 text-[15px] font-bold">
              <span className="num">{formatLocalDate(g.date)}</span>
              <span className={cn("text-[13px] font-semibold", days === 0 ? "text-accent-text" : "text-muted")}>
                {days === 0 ? "오늘" : days === 1 ? "내일" : `${days}일 후`}
              </span>
            </h3>
            <EventList items={g.events} onEdit={onEdit} byId={byId} />
          </li>
        );
      })}
    </ol>
  );
}

function EventList({
  items,
  onEdit,
  byId,
  showDate,
}: {
  items: CalendarEvent[];
  onEdit: (id: string) => void;
  byId: ReturnType<typeof useAnnouncements>["byId"];
  showDate?: boolean;
}) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
      {items.map((e) => {
        const a = e.announcementId ? byId.get(e.announcementId) : undefined;
        const changed = pendingRevisions(e, a).length > 0;
        return (
          <li key={e.id} className="px-4 py-3 text-[13px]">
            <div className="flex items-start gap-2">
              <KindTag kind={e.kind} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-keep">{e.title}</p>
                <p className="num mt-0.5 text-xs text-muted">{showDate || e.timing.type === "timed" ? formatTiming(e.timing) : e.timing.timeUnknown ? "시각 미공지" : "종일"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {changed ? <Badge tone="warning">변경 확인 필요</Badge> : null}
                  {a?.status === "cancelled" ? <Badge tone="danger">{a.category === "job" ? "채용 마감" : "공고 취소됨"}</Badge> : null}
                  {e.reminders.length ? (
                    <span className="text-xs text-muted">알림 {e.reminders.map((r) => offsetLabel(r.offset)).join(", ")}</span>
                  ) : (
                    <span className="text-xs text-faint">알림 없음</span>
                  )}
                </div>
                {a ? (
                  <Link href={announcementHref(a.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline">
                    원본 공고 보기
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
              <IconButton label={`일정 수정: ${e.title}`} className="size-8" onClick={() => onEdit(e.id)}>
                <Pencil className="size-4" aria-hidden />
              </IconButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
