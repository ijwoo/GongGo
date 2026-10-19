"use client";

import { GitCompareArrows, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, PageFrame, PageHeader } from "@/components/common/page";
import { OrgMark } from "@/components/discover/org-mark";
import { StateBadge } from "@/components/discover/status";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass, IconButton } from "@/components/ui/button";
import {
  CATEGORY_LABEL,
  formatCost,
  formatDeadline,
  formatEventSchedule,
  formatSupport,
  formatTeamSize,
  formatVenue,
  MODE_LABEL,
} from "@/domain/announcement";
import { ELIGIBILITY_LABEL, evaluateCondition } from "@/domain/eligibility";
import type { Announcement } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { useAnnouncements, useNow } from "@/lib/app-data";
import { clearCompare, COMPARE_LIMIT, toggleCompare, useCompare, useHydrated } from "@/lib/personal-store";

const NO_INFO = <span className="text-faint">정보 없음</span>;

function list(items: string[], empty: ReactNode = NO_INFO): ReactNode {
  if (items.length === 0) return empty;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function CompareView() {
  const ids = useCompare();
  const hydrated = useHydrated();
  const { byId } = useAnnouncements();
  const now = useNow();
  const { state, loggedIn } = usePersonal();
  const items = ids.map((id) => byId.get(id)).filter((a): a is Announcement => Boolean(a));

  const toCheck = (a: Announcement): string[] => {
    const fromConditions = a.conditions
      .filter((c) => c.kind === "required")
      .filter((c) => {
        const r = evaluateCondition(c, loggedIn ? state.profile : null).result;
        return r === "check" || (!loggedIn && !c.rule);
      })
      .map((c) => `${c.text} (${ELIGIBILITY_LABEL.check})`);
    return [...a.checkPoints, ...fromConditions];
  };

  const rows: { label: string; render: (a: Announcement) => ReactNode }[] = [
    { label: "분야", render: (a) => CATEGORY_LABEL[a.category] },
    { label: "접수 상태", render: (a) => <StateBadge a={a} now={now} /> },
    { label: "진행 방식", render: (a) => MODE_LABEL[a.participationMode] },
    { label: "장소", render: (a) => formatVenue(a.venue) },
    { label: "신청 마감", render: (a) => <span className="num">{formatDeadline(a.applicationDeadline)}</span> },
    { label: "행사 일정", render: (a) => <span className="num">{formatEventSchedule(a.event)}</span> },
    { label: "참가비", render: (a) => (a.cost ? formatCost(a.cost) : NO_INFO) },
    { label: "지원 규모", render: (a) => (a.supportAmount ? formatSupport(a.supportAmount) : NO_INFO) },
    { label: "팀 규모", render: (a) => (a.teamSize ? formatTeamSize(a.teamSize) : NO_INFO) },
    { label: "필수 조건", render: (a) => list(a.conditions.filter((c) => c.kind === "required").map((c) => c.text)) },
    { label: "준비 서류", render: (a) => list(a.requiredDocuments) },
    { label: "확인 필요", render: (a) => list(toCheck(a), <span className="text-faint">따로 확인할 항목 없음</span>) },
  ];

  return (
    <PageFrame>
      <PageHeader
        title="공고 비교"
        description={`최대 ${COMPARE_LIMIT}개까지 나란히 비교해요. 비교 목록은 로그인하지 않아도 이 브라우저에 유지돼요.`}
        actions={
          items.length ? (
            <Button size="sm" onClick={clearCompare}>
              모두 비우기
            </Button>
          ) : null
        }
      />
      {!hydrated ? (
        <div className="h-64 animate-pulse rounded-lg bg-subtle" aria-busy="true" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<GitCompareArrows className="size-6 text-faint" aria-hidden />}
          title="비교할 공고를 담아 주세요"
          description="발견 화면 목록의 ‘비교’ 칸을 선택하거나 상세의 ‘비교에 추가’를 누르세요."
          action={
            <Link href="/discover" className={buttonClass("primary")}>
              공고 고르러 가기
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-[13px]">
            <caption className="sr-only">선택한 공고 {items.length}개 비교</caption>
            <colgroup>
              <col className="w-[120px]" />
              {items.map((a) => (
                <col key={a.id} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line align-top">
                <th scope="col" className="sticky left-0 z-[1] bg-panel px-3 py-3 text-left text-xs font-medium text-muted">
                  공고
                </th>
                {items.map((a) => (
                  <th key={a.id} scope="col" className="px-3 py-3 text-left font-normal">
                    <div className="flex items-start gap-2">
                      <OrgMark org={a.organizer} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/discover?id=${a.id}`} className="font-semibold break-keep hover:underline">
                          {a.title}
                        </Link>
                        <p className="text-xs text-muted">{a.organizer.name}</p>
                        {a.status === "cancelled" ? <Badge tone="danger">취소됨</Badge> : null}
                      </div>
                      <IconButton label={`비교에서 빼기: ${a.title}`} className="size-7" onClick={() => toggleCompare(a.id)}>
                        <X className="size-4" aria-hidden />
                      </IconButton>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="sticky left-0 z-[1] bg-panel px-3 py-2.5 text-left text-xs font-medium text-muted shadow-[1px_0_0_var(--line)]">
                    {r.label}
                  </th>
                  {items.map((a) => (
                    <td key={a.id} className="px-3 py-2.5 break-keep">
                      {r.render(a)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length > 0 && items.length < COMPARE_LIMIT ? (
        <p className="mt-3 text-[13px] text-muted">
          {COMPARE_LIMIT - items.length}개 더 담을 수 있어요.{" "}
          <Link href="/discover" className="font-semibold text-accent-text hover:underline">
            공고 더 고르기
          </Link>
        </p>
      ) : null}
    </PageFrame>
  );
}
