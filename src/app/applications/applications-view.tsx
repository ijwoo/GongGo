"use client";

import { ClipboardList, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoginRequired } from "@/components/auth/login-required";
import { KindTag } from "@/components/calendar/event-kind";
import { EmptyState, PageFrame, PageHeader } from "@/components/common/page";
import { OrgMark } from "@/components/discover/org-mark";
import { DeadlineCell, StateBadge } from "@/components/discover/status";
import { Button, buttonClass, IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatTiming, sortEvents } from "@/domain/calendar";
import { APPLICATION_STATUSES, type Announcement, type ApplicationRecord, type ApplicationStatus } from "@/domain/types";
import { newId, usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { removeApplication, upsertApplication } from "@/lib/personal-actions";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  reviewing: "검토 중",
  preparing: "준비 중",
  submitted: "지원 완료",
  closed: "종료",
};

export function ApplicationsView() {
  return (
    <PageFrame>
      <PageHeader title="지원 현황" description="지원하려는 공고의 상태, 준비 항목, 메모, 연결된 일정을 관리해요." />
      <LoginRequired reason="지원 현황은 계정에 저장돼요.">
        <ApplicationsBody />
      </LoginRequired>
    </PageFrame>
  );
}

function ApplicationsBody() {
  const { state } = usePersonal();
  const { byId } = useAnnouncements();
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const records = state.applications.filter((r) => byId.has(r.announcementId));
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, records.filter((r) => r.status === s).length])) as Record<ApplicationStatus, number>;
  const visible = filter === "all" ? records : records.filter((r) => r.status === filter);

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-6 text-faint" aria-hidden />}
        title="지원 준비 중인 공고가 없어요"
        description="공고 상세에서 ‘지원 준비에 추가’를 누르면 준비 서류가 체크리스트로 만들어져요."
        action={
          <Link href="/discover" className={buttonClass("primary")}>
            공고 둘러보기
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="상태별 보기">
        {(["all", ...APPLICATION_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={cn(
              "num h-8 rounded-md border px-3 text-[13px] font-semibold",
              filter === s ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-panel text-muted hover:text-fg",
            )}
          >
            {s === "all" ? `전체 ${records.length}` : `${STATUS_LABEL[s]} ${counts[s]}`}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-md border border-line bg-panel px-4 py-8 text-center text-[13px] text-muted">이 상태의 공고가 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <ApplicationCard key={r.announcementId} record={r} a={byId.get(r.announcementId)!} />
          ))}
        </ul>
      )}
    </>
  );
}

function ApplicationCard({ record, a }: { record: ApplicationRecord; a: Announcement }) {
  const { state, update } = usePersonal();
  const now = useNow();
  const toast = useToast();
  const [newItem, setNewItem] = useState("");
  const [memo, setMemo] = useState(record.memo);
  const done = record.checklist.filter((c) => c.done).length;
  const events = sortEvents(state.events.filter((e) => e.announcementId === a.id));
  const patch = (p: Parameters<typeof upsertApplication>[2]) => update((s) => upsertApplication(s, a, p, now, newId));

  return (
    <li className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3">
        <OrgMark org={a.organizer} size="sm" />
        <div className="min-w-0 flex-1">
          <Link href={`/discover?id=${a.id}`} className="font-semibold hover:underline">
            {a.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <StateBadge a={a} now={now} />
            {a.organizer.name}
          </p>
        </div>
        <div className="w-28 shrink-0">
          <DeadlineCell a={a} now={now} />
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="sr-only">지원 상태: {a.title}</span>
          <select
            value={record.status}
            onChange={(e) => {
              patch({ status: e.target.value as ApplicationStatus });
              toast({ message: `상태를 ‘${STATUS_LABEL[e.target.value as ApplicationStatus]}’(으)로 바꿨어요.` });
            }}
            className="h-9 rounded-md border border-line bg-panel px-2 font-semibold"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 px-4 py-3 md:grid-cols-3">
        <section aria-label="준비 항목">
          <h3 className="mb-1.5 text-[13px] font-semibold">
            준비 항목 <span className="num font-normal text-muted">{done}/{record.checklist.length}</span>
          </h3>
          <ul className="space-y-1">
            {record.checklist.map((item) => (
              <li key={item.id} className="group flex items-center gap-2 text-[13px]">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => patch({ checklist: record.checklist.map((c) => (c.id === item.id ? { ...c, done: e.target.checked } : c)) })}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className={cn("truncate", item.done && "text-muted line-through")}>{item.label}</span>
                </label>
                <IconButton
                  label={`준비 항목 삭제: ${item.label}`}
                  className="size-6 opacity-60 group-hover:opacity-100"
                  onClick={() => patch({ checklist: record.checklist.filter((c) => c.id !== item.id) })}
                >
                  <X className="size-3.5" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const label = newItem.trim();
              if (!label) return;
              patch({ checklist: [...record.checklist, { id: newId(), label: label.slice(0, 100), done: false }] });
              setNewItem("");
            }}
          >
            <label className="sr-only" htmlFor={`new-${a.id}`}>
              준비 항목 추가
            </label>
            <input
              id={`new-${a.id}`}
              value={newItem}
              maxLength={100}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="예: 포트폴리오 링크 정리"
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[13px] placeholder:text-faint"
            />
            <Button type="submit" size="sm" disabled={!newItem.trim()}>
              <Plus className="size-3.5" aria-hidden />
              추가
            </Button>
          </form>
        </section>
        <section aria-label="연결된 일정">
          <h3 className="mb-1.5 text-[13px] font-semibold">연결된 일정</h3>
          {events.length === 0 ? (
            <p className="text-[13px] text-muted">
              연결된 일정이 없어요.{" "}
              <Link href={`/discover?id=${a.id}`} className="font-semibold text-accent-text hover:underline">
                공고에서 추가
              </Link>
            </p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {events.map((e) => (
                <li key={e.id}>
                  <Link href={`/calendar?event=${e.id}&date=${e.timing.type === "allDay" ? e.timing.start : ""}`} className="flex items-start gap-1.5 hover:underline">
                    <KindTag kind={e.kind} />
                    <span className="num text-xs">{formatTiming(e.timing)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="메모">
          <label htmlFor={`memo-${a.id}`} className="mb-1.5 block text-[13px] font-semibold">
            메모
          </label>
          <textarea
            id={`memo-${a.id}`}
            value={memo}
            maxLength={2000}
            rows={4}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => memo !== record.memo && patch({ memo })}
            placeholder="지원 동기, 팀원 역할 등 (자동 저장)"
            className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-[13px] placeholder:text-faint"
          />
        </section>
      </div>
      <div className="flex justify-end border-t border-line px-4 py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            update((s) => removeApplication(s, a.id));
            toast({ message: "지원 현황에서 뺐어요.", action: { label: "되돌리기", onClick: () => update((s) => ({ ...s, applications: [...s.applications, record] })) } });
          }}
        >
          <Trash2 className="size-4 text-muted" aria-hidden />
          지원 현황에서 빼기
        </Button>
      </div>
    </li>
  );
}
