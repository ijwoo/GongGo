"use client";

import { AlertTriangle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Download, Pencil } from "lucide-react";
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
  EVENT_KIND_LABEL,
  formatTiming,
  monthGrid,
  occursOn,
  pendingRevisions,
  proposedTiming,
  sortEvents,
  upcomingEvents,
} from "@/domain/calendar";
import { buildIcs } from "@/domain/ics";
import { offsetLabel } from "@/domain/reminders";
import { addLocalDays, formatLocalDate, formatMonth } from "@/domain/time";
import { EVENT_KINDS, type CalendarEvent, type EventKind } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow, useToday } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { deleteEvent, eventsNeedingReview, resolveEventChange, updateEvent } from "@/lib/personal-actions";
import { announcementHref } from "@/lib/announcement-href";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

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
  return { month, date, kinds, editing, set };
}

function CalendarBody() {
  const today = useToday();
  const now = useNow();
  const toast = useToast();
  const { state, update } = usePersonal();
  const { byId } = useAnnouncements();
  const { month, date, kinds, editing, set } = useCalendarParams(today);
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
    toast({ message: `일정 ${target.length}개를 .ics 파일로 내려받았어요.` });
  };

  const toggleKind = (k: EventKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    set({ kinds: next.length === EVENT_KINDS.length ? null : next.join(",") || "none" });
  };

  const dayEvents = sortEvents(events.filter((e) => occursOn(e, date)));
  const upcoming = upcomingEvents(events, today).slice(0, 8);

  return (
    <>
      <PageHeader
        title="내 캘린더"
        description="관심 저장과 별개로, 직접 추가한 신청 마감·행사·준비 일정을 모아 봐요. 시간은 한국 시간 기준이에요."
        actions={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button size="sm" onClick={exportIcs}>
              <Download className="size-4" aria-hidden />
              .ics 내보내기
            </Button>
            <p className="max-w-64 text-[11px] text-faint sm:text-right">한 번 내려받는 파일이에요. 이후 변경은 외부 캘린더에 자동 반영되지 않아요.</p>
          </div>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="month-title" className="rounded-lg border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <IconButton label="이전 달" onClick={() => moveMonth(-1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </IconButton>
            <h2 id="month-title" className="num min-w-28 text-center font-bold" aria-live="polite">
              {formatMonth(year, month1)}
            </h2>
            <IconButton label="다음 달" onClick={() => moveMonth(1)}>
              <ChevronRight className="size-4" aria-hidden />
            </IconButton>
            <Button size="sm" variant="ghost" onClick={() => selectDate(today)}>
              오늘
            </Button>
            <fieldset className="ml-auto flex flex-wrap items-center gap-3 text-[13px]">
              <legend className="sr-only">일정 종류 필터</legend>
              {EVENT_KINDS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={kinds.includes(k)} onChange={() => toggleKind(k)} />
                  <KindTag kind={k} />
                  <span className="hidden sm:inline">{EVENT_KIND_LABEL[k]}</span>
                </label>
              ))}
            </fieldset>
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
                          "flex h-20 w-full flex-col items-stretch gap-0.5 p-1 text-left transition-colors md:h-24",
                          selected ? "bg-accent-soft" : "hover:bg-subtle",
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

        <div className="space-y-4">
          <section aria-labelledby="day-title" className="rounded-lg border border-line bg-panel">
            <h2 id="day-title" className="border-b border-line px-4 py-2.5 text-sm font-bold">
              {formatLocalDate(date)} {date === today ? "· 오늘" : ""}
            </h2>
            {dayEvents.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted">이 날짜에는 일정이 없어요.</p>
            ) : (
              <EventList items={dayEvents} onEdit={(id) => set({ event: id }, "push")} byId={byId} />
            )}
          </section>
          <section aria-labelledby="upcoming-title" className="rounded-lg border border-line bg-panel">
            <h2 id="upcoming-title" className="border-b border-line px-4 py-2.5 text-sm font-bold">
              다가오는 일정
            </h2>
            {upcoming.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<CalendarDays className="size-6 text-faint" aria-hidden />}
                  title="다가오는 일정이 없어요"
                  description="공고 상세에서 ‘내 캘린더에 추가’를 눌러 보세요."
                  action={
                    <Link href="/discover" className={buttonClass("primary", "sm")}>
                      공고 둘러보기
                    </Link>
                  }
                />
              </div>
            ) : (
              <EventList items={upcoming} onEdit={(id) => set({ event: id }, "push")} byId={byId} showDate />
            )}
          </section>
        </div>
      </div>

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
    </>
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
    <ul className="divide-y divide-line">
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
