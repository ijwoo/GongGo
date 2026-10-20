"use client";

import { AlertCircle, BellOff, BellRing, CalendarClock, FileWarning } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoginRequired } from "@/components/auth/login-required";
import { EmptyState, PageFrame, PageHeader } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nextReminders, offsetLabel } from "@/domain/reminders";
import { formatSeoulDateTime } from "@/domain/time";
import type { AppNotification } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { useEmailConfigured, useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/personal-actions";
import { announcementHref } from "@/lib/announcement-href";

export function NotificationsView() {
  return (
    <PageFrame>
      <LoginRequired reason="알림은 계정의 일정과 관심 공고를 기준으로 만들어져요.">
        <NotificationsBody />
      </LoginRequired>
    </PageFrame>
  );
}

function linkOf(n: AppNotification): { href: string; label: string } | null {
  if (!n.link) return null;
  return n.link.kind === "announcement"
    ? { href: announcementHref(n.link.id), label: "공고 보기" }
    : { href: `/calendar?event=${n.link.id}`, label: "일정 보기" };
}

function NotificationsBody() {
  const { state, update } = usePersonal();
  const now = useNow();
  const emailConfigured = useEmailConfigured();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unread = state.notifications.filter((n) => !n.read).length;
  const items = unreadOnly ? state.notifications.filter((n) => !n.read) : state.notifications;
  const upcoming = nextReminders(state.events, now, new Set(state.sentReminderKeys), 5);
  const eventsById = new Map(state.events.map((e) => [e.id, e]));

  return (
    <>
      <PageHeader
        title="알림"
        description="일정 알림과 관심 공고 변경 알림을 모아 봐요."
        actions={
          <Button size="sm" disabled={unread === 0} onClick={() => update(markAllNotificationsRead)}>
            모두 읽음
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="inbox-title">
          <h2 id="inbox-title" className="sr-only">
            알림 목록
          </h2>
          <div className="mb-3 flex gap-2" role="group" aria-label="보기">
            {[
              { v: false, label: `전체 ${state.notifications.length}` },
              { v: true, label: `안 읽음 ${unread}` },
            ].map((t) => (
              <button
                key={String(t.v)}
                type="button"
                aria-pressed={unreadOnly === t.v}
                onClick={() => setUnreadOnly(t.v)}
                className={cn(
                  "num h-8 rounded-md border px-3 text-[13px] font-semibold",
                  unreadOnly === t.v ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-panel text-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={<BellOff className="size-6 text-faint" aria-hidden />}
              title={unreadOnly ? "읽지 않은 알림이 없어요" : "아직 알림이 없어요"}
              description="캘린더 일정에 알림을 설정하거나, 관심 공고가 바뀌면 여기에 표시돼요."
            />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
              {items.map((n) => {
                const link = linkOf(n);
                const Icon = n.delivery === "failed" ? AlertCircle : n.type === "change" ? FileWarning : n.type === "reminder" ? CalendarClock : BellRing;
                return (
                  <li key={n.id} className={cn("flex gap-3 px-4 py-3 text-[13px]", !n.read && "bg-accent-soft/50")}>
                    <Icon className={cn("mt-0.5 size-4 shrink-0", n.delivery === "failed" ? "text-danger" : "text-muted")} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        {!n.read ? <Badge tone="accent">안 읽음</Badge> : null}
                        {n.delivery === "failed" ? <Badge tone="danger">발송 실패</Badge> : null}
                        {n.title}
                      </p>
                      <p className="mt-0.5 break-keep">{n.body}</p>
                      {n.failureReason ? <p className="mt-0.5 text-xs text-danger">{n.failureReason}</p> : null}
                      <p className="num mt-1 text-xs text-muted">{formatSeoulDateTime(n.createdAt)} · 앱 내 알림</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {link ? (
                        <Link
                          href={link.href}
                          onClick={() => update((s) => markNotificationRead(s, n.id))}
                          className="text-xs font-semibold text-accent-text hover:underline"
                        >
                          {link.label}
                        </Link>
                      ) : null}
                      {!n.read ? (
                        <button type="button" onClick={() => update((s) => markNotificationRead(s, n.id))} className="text-xs text-muted hover:text-fg">
                          읽음 표시
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <section aria-labelledby="channel-title" className="rounded-lg border border-line bg-panel p-4 text-[13px]">
            <h2 id="channel-title" className="mb-2 text-sm font-bold">
              받는 곳
            </h2>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt>앱 내 알림</dt>
                <dd>
                  <Badge tone="success">사용 중</Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>이메일</dt>
                <dd>{emailConfigured ? <Badge tone="neutral">제공자 설정됨 · 발송 준비 중</Badge> : <Badge tone="warning">설정되지 않음</Badge>}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              공고 변경 알림은 서버가 공고를 다시 수집할 때 만들어요. 일정 알림은 예약 시각이 지난 뒤 공고함을 열면(열어 둔 동안 포함) 앱 내 알림으로 만들어지고, 계정에 저장돼 다른 기기에서도 보여요.
            </p>
            <Link href="/settings#alerts" className="mt-2 inline-block text-xs font-semibold text-accent-text hover:underline">
              공고 변경 알림 설정
            </Link>
          </section>

          <section aria-labelledby="scheduled-title" className="rounded-lg border border-line bg-panel p-4 text-[13px]">
            <h2 id="scheduled-title" className="mb-2 text-sm font-bold">
              예약된 알림 미리보기
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-muted">예약된 알림이 없어요.</p>
            ) : (
              <ul className="space-y-1.5">
                {upcoming.map((r) => (
                  <li key={r.key} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {eventsById.get(r.eventId)?.title} · {offsetLabel(r.reminder.offset)}
                    </span>
                    <span className="num shrink-0 text-muted">{formatSeoulDateTime(r.fireAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
