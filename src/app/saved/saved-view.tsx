"use client";

import { Bookmark, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginRequired } from "@/components/auth/login-required";
import { EmptyState, PageFrame, PageHeader, ViewTabs } from "@/components/common/page";
import { CompareCheckbox } from "@/components/discover/compare-toggle";
import { Poster } from "@/components/discover/poster";
import { DeadlineCell, StateBadge } from "@/components/discover/status";
import { buttonClass, IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, venueShort } from "@/domain/announcement";
import { cardEventLabel } from "@/domain/card";
import { sortAnnouncements } from "@/domain/discover";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow } from "@/lib/app-data";
import { toggleSaved } from "@/lib/personal-actions";
import { announcementHref } from "@/lib/announcement-href";

export function SavedView() {
  return (
    <PageFrame>
      <PageHeader title="관심 공고" description="저장한 공고를 마감이 가까운 순으로 보고, 저장한 뒤 바뀐 내용을 확인해요." />
      <LoginRequired reason="관심 공고는 계정에 저장돼요.">
        <SavedList />
      </LoginRequired>
    </PageFrame>
  );
}

/** 관심 공고: 갤러리 카드와 같은 표지·분야·제목·주최·날짜 순서를 가로 한 줄로 */
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
  const visible = changedOnly ? entries.filter((e) => e.a.contentVersion > e.saved.seenVersion) : entries;
  const ordered = sortAnnouncements(visible.map((e) => e.a), "deadline", now).map((a) => visible.find((e) => e.a.id === a.id)!);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="size-6 text-faint" aria-hidden />}
        title="아직 저장한 공고가 없어요"
        description="공고 카드의 저장 버튼을 누르면 여기에 모여요."
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
      <ViewTabs
        label="보기"
        value={changedOnly ? "changed" : "all"}
        onChange={(v) => router.replace(v === "changed" ? "/saved?changed=1" : "/saved", { scroll: false })}
        items={[
          { value: "all", label: "전체", count: entries.length },
          { value: "changed", label: "변경 있음", count: changedCount },
        ]}
      />
      {ordered.length === 0 ? (
        <p className="rounded-lg bg-subtle px-4 py-10 text-center text-sm text-muted">저장 이후 바뀐 공고가 없어요.</p>
      ) : (
        <ul className="divide-y divide-line" aria-label="관심 공고 목록">
          {ordered.map(({ a, saved }) => {
            const changed = a.contentVersion > saved.seenVersion;
            const lastRev = a.revisions.at(-1);
            const event = cardEventLabel(a);
            return (
              <li key={a.id} className="grid grid-cols-[96px_minmax(0,1fr)_auto] gap-x-4 gap-y-2 py-5 first:pt-0 sm:grid-cols-[152px_minmax(0,1fr)_auto]">
                <Link href={announcementHref(a.id)} tabIndex={-1} aria-hidden className="self-start">
                  <Poster a={a} />
                </Link>
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-muted">
                    <span className="font-semibold text-accent-text">{CATEGORY_LABEL[a.category]}</span>
                    <span aria-hidden> · </span>
                    {venueShort(a)}
                  </p>
                  <Link href={announcementHref(a.id)} className="mt-0.5 line-clamp-2 text-[17px] leading-snug font-semibold break-keep hover:text-accent-text">
                    {a.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-fg-2">{a.organizer.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <StateBadge a={a} now={now} />
                    {event ? <span className="num text-muted">{event}</span> : null}
                  </div>
                  {changed && lastRev ? (
                    <p className="mt-2.5 flex gap-1.5 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-fg-2">
                      <History className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                      <span className="min-w-0 break-keep">
                        <b className="text-warning">변경 있음</b> · {lastRev.summary} <span className="text-muted line-through">{lastRev.before}</span> →{" "}
                        <b>{lastRev.after}</b>
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end justify-between gap-3">
                  <div className="hidden w-[116px] text-right sm:block">
                    <DeadlineCell a={a} now={now} />
                  </div>
                  <div className="flex items-center gap-0.5">
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
