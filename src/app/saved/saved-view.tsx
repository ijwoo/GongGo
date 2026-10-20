"use client";

import { Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginRequired } from "@/components/auth/login-required";
import { EmptyState, PageFrame, PageHeader } from "@/components/common/page";
import { CompareCheckbox } from "@/components/discover/compare-toggle";
import { OrgMark } from "@/components/discover/org-mark";
import { DeadlineCell, StateBadge } from "@/components/discover/status";
import { Badge } from "@/components/ui/badge";
import { buttonClass, IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, MODE_LABEL, venueShort } from "@/domain/announcement";
import { sortAnnouncements } from "@/domain/discover";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { toggleSaved } from "@/lib/personal-actions";
import { announcementHref } from "@/lib/announcement-href";

export function SavedView() {
  return (
    <PageFrame>
      <PageHeader title="관심 공고" description="저장한 공고와 저장 이후 바뀐 내용을 확인해요." />
      <LoginRequired reason="관심 공고는 계정에 저장돼요.">
        <SavedList />
      </LoginRequired>
    </PageFrame>
  );
}

function SavedList() {
  const { state, update } = usePersonal();
  const { byId } = useAnnouncements();
  const now = useNow();
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const changedOnly = params.get("changed") === "1";

  const entries = state.saved
    .map((s) => ({ saved: s, a: byId.get(s.announcementId) }))
    .filter((x): x is { saved: typeof x.saved; a: NonNullable<typeof x.a> } => Boolean(x.a));
  const changedCount = entries.filter((e) => e.a.contentVersion > e.saved.seenVersion).length;
  const visible = (changedOnly ? entries.filter((e) => e.a.contentVersion > e.saved.seenVersion) : entries);
  const ordered = sortAnnouncements(visible.map((e) => e.a), "deadline", now).map((a) => visible.find((e) => e.a.id === a.id)!);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Star className="size-6 text-faint" aria-hidden />}
        title="아직 저장한 공고가 없어요"
        description="발견 화면에서 별 버튼을 눌러 관심 공고로 저장하세요."
        action={
          <Link href="/discover" className={buttonClass("primary")}>
            공고 둘러보기
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2" role="group" aria-label="보기">
        {[
          { v: false, label: `전체 ${entries.length}` },
          { v: true, label: `변경 있음 ${changedCount}` },
        ].map((t) => (
          <button
            key={String(t.v)}
            type="button"
            aria-pressed={changedOnly === t.v}
            onClick={() => router.replace(t.v ? "/saved?changed=1" : "/saved", { scroll: false })}
            className={cn(
              "num h-8 rounded-md border px-3 text-[13px] font-semibold",
              changedOnly === t.v ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-panel text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {ordered.length === 0 ? (
        <p className="rounded-md border border-line bg-panel px-4 py-8 text-center text-[13px] text-muted">저장 이후 바뀐 공고가 없어요.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <div
            aria-hidden
            className="hidden h-10 items-center gap-4 border-b border-line px-4 text-xs font-semibold text-muted lg:grid lg:grid-cols-[minmax(0,2.2fr)_96px_128px_132px_minmax(0,1.6fr)_88px]"
          >
            <span>공고명 · 주최기관</span>
            <span>분야</span>
            <span>장소 · 방식</span>
            <span>신청 마감</span>
            <span>저장 이후 변경</span>
            <span className="text-right">비교 · 빼기</span>
          </div>
          <ul className="divide-y divide-line">
            {ordered.map(({ a, saved }) => {
              const changed = a.contentVersion > saved.seenVersion;
              const lastRev = a.revisions.at(-1);
              return (
                <li
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-hover lg:grid-cols-[minmax(0,2.2fr)_96px_128px_132px_minmax(0,1.6fr)_88px]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <OrgMark org={a.organizer} />
                    <div className="min-w-0">
                      <Link href={announcementHref(a.id)} className="line-clamp-2 text-[15px] leading-snug font-semibold hover:text-accent-text">
                        {a.title}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                        <span className="truncate">{a.organizer.name}</span>
                        <StateBadge a={a} now={now} />
                        {changed ? <Badge tone="warning">변경 있음</Badge> : null}
                        <span className="lg:hidden">
                          · {CATEGORY_LABEL[a.category]} · {venueShort(a)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="hidden text-sm text-fg-2 lg:block">{CATEGORY_LABEL[a.category]}</span>
                  <span className="hidden flex-col gap-0.5 leading-tight lg:flex">
                    <span className="text-sm text-fg-2">{venueShort(a)}</span>
                    <span className="text-xs text-muted">{MODE_LABEL[a.participationMode]}</span>
                  </span>
                  <span className="hidden lg:block">
                    <DeadlineCell a={a} now={now} />
                  </span>
                  <span className="col-span-2 min-w-0 text-[13px] lg:col-span-1">
                    {changed && lastRev ? (
                      <>
                        <span className="text-fg-2">{lastRev.summary}</span>{" "}
                        <span className="text-muted line-through">{lastRev.before}</span> → <b>{lastRev.after}</b>
                      </>
                    ) : (
                      <span className="hidden text-faint lg:inline">변경 없음</span>
                    )}
                  </span>
                  <div className="row-start-1 flex items-center justify-end gap-0.5 col-start-2 lg:col-start-auto lg:row-start-auto">
                    <CompareCheckbox a={a} />
                    <IconButton
                      label={`관심 공고에서 빼기: ${a.title}`}
                      onClick={() => {
                        update((s) => toggleSaved(s, a, now));
                        toast({ message: "관심 공고에서 뺐어요.", action: { label: "되돌리기", onClick: () => update((s) => ({ ...s, saved: [...s.saved, saved] })) } });
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
