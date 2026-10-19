"use client";

import Link from "next/link";
import { CATEGORY_LABEL, formatCost, formatSupport, formatTeamSize, MODE_LABEL, venueShort } from "@/domain/announcement";
import type { Announcement } from "@/domain/types";
import { cn } from "@/lib/cn";
import { CompareCheckbox } from "./compare-toggle";
import { OrgMark } from "./org-mark";
import { SaveButton } from "./save-button";
import { DeadlineCell, StateBadge } from "./status";

interface ListProps {
  items: Announcement[];
  now: string;
  selectedId: string | null;
  hrefFor: (id: string) => string;
  onSelect: (id: string) => void;
}

function keyCondition(a: Announcement): string {
  if (a.teamSize) return formatTeamSize(a.teamSize);
  const first = a.conditions.find((c) => c.kind === "required");
  return first?.text ?? "정보 없음";
}

function ModeVenue({ a }: { a: Announcement }) {
  return (
    <span className="flex flex-col gap-0.5 leading-tight">
      <span className="text-sm text-fg-2">{venueShort(a)}</span>
      <span className="text-xs text-muted">{MODE_LABEL[a.participationMode]}</span>
    </span>
  );
}

function TitleLink({ a, href, selected, onSelect }: { a: Announcement; href: string; selected: boolean; onSelect: () => void }) {
  return (
    <Link
      href={href}
      scroll={false}
      replace
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // 새 탭 열기는 그대로 둔다
        e.preventDefault();
        onSelect();
      }}
      className={cn(
        "line-clamp-2 text-[15px] leading-snug font-semibold text-fg hover:text-accent-text",
        a.status === "cancelled" && "text-muted line-through decoration-1",
      )}
    >
      {a.title}
    </Link>
  );
}

/** 데스크톱 표. 행 아무 곳이나 눌러도 선택되지만, 저장·비교 버튼은 행 선택을 일으키지 않는다.
 *  넓은 화면일수록 비교에 쓸 열(팀 규모·참가비·지원 규모)을 더 보여 준다. */
export function AnnouncementTable({ items, now, selectedId, hrefFor, onSelect }: ListProps) {
  const th = "px-3 text-left text-xs font-semibold text-muted";
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">공고 목록. 행을 선택하면 오른쪽에 상세가 표시됩니다.</caption>
      <colgroup>
        <col className="w-12" />
        <col />
        <col className="w-[92px]" />
        <col className="w-[120px]" />
        <col className="w-[132px]" />
        <col className="hidden w-[140px] xl:table-column" />
        <col className="hidden w-[96px] 2xl:table-column" />
        <col className="hidden w-[168px] 2xl:table-column" />
        <col className="hidden lg:table-column" />
        <col className="w-14" />
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-panel shadow-[inset_0_-1px_0_var(--line)]">
        <tr className="h-10">
          <th scope="col" className="pl-4">
            <span className="sr-only">관심 저장</span>
          </th>
          <th scope="col" className={th}>공고명 · 주최기관</th>
          <th scope="col" className={th}>분야</th>
          <th scope="col" className={th}>장소 · 방식</th>
          <th scope="col" className={th}>신청 마감</th>
          <th scope="col" className={cn(th, "hidden xl:table-cell")}>팀 규모·핵심 조건</th>
          <th scope="col" className={cn(th, "hidden 2xl:table-cell")}>참가비</th>
          <th scope="col" className={cn(th, "hidden 2xl:table-cell")}>지원 규모</th>
          <th scope="col" className={cn(th, "hidden lg:table-cell")}>확인할 사항</th>
          <th scope="col" className="pr-4 text-center text-xs font-semibold text-muted">비교</th>
        </tr>
      </thead>
      <tbody>
        {items.map((a) => {
          const selected = a.id === selectedId;
          return (
            <tr
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={cn(
                "cursor-pointer border-b border-line align-middle transition-colors",
                selected ? "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]" : "hover:bg-hover",
              )}
            >
              <td className="py-3 pl-3">
                <SaveButton a={a} />
              </td>
              <td className="px-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <OrgMark org={a.organizer} />
                  <div className="min-w-0">
                    <TitleLink a={a} href={hrefFor(a.id)} selected={selected} onSelect={() => onSelect(a.id)} />
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[13px] text-muted">{a.organizer.name}</span>
                      <StateBadge a={a} now={now} />
                      {a.revisions.length > 0 ? (
                        <span className="shrink-0 text-xs font-semibold text-warning">변경 {a.revisions.length}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 text-sm text-fg-2">{CATEGORY_LABEL[a.category]}</td>
              <td className="px-3">
                <ModeVenue a={a} />
              </td>
              <td className="px-3">
                <DeadlineCell a={a} now={now} />
              </td>
              <td className="hidden px-3 text-[13px] text-fg-2 xl:table-cell">
                <span className="line-clamp-2">{keyCondition(a)}</span>
              </td>
              <td className="num hidden px-3 text-[13px] text-fg-2 2xl:table-cell">{a.cost ? formatCost(a.cost) : <span className="text-faint">정보 없음</span>}</td>
              <td className="hidden px-3 text-[13px] text-fg-2 2xl:table-cell">
                <span className="line-clamp-2">{a.supportAmount ? formatSupport(a.supportAmount) : <span className="text-faint">정보 없음</span>}</span>
              </td>
              <td className="hidden px-3 text-[13px] text-muted lg:table-cell">
                {a.checkPoints.length ? (
                  <span className="line-clamp-2">
                    {a.checkPoints.join(" · ")}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="pr-3 text-center">
                <CompareCheckbox a={a} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 좁은 화면용 목록. 표의 핵심 정보(이름·상태·마감·장소)를 유지한다 */
export function AnnouncementCompactList({ items, now, selectedId, hrefFor, onSelect }: ListProps) {
  return (
    <ul className="divide-y divide-line" aria-label="공고 목록">
      {items.map((a) => {
        const selected = a.id === selectedId;
        return (
          <li key={a.id} className={cn("flex gap-2 px-4 py-3.5", selected && "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]")}>
            <div className="min-w-0 flex-1" onClick={() => onSelect(a.id)}>
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <StateBadge a={a} now={now} />
                <span className="text-xs text-muted">
                  {CATEGORY_LABEL[a.category]} · {venueShort(a)}
                  {a.venue.status !== "online" ? ` · ${MODE_LABEL[a.participationMode]}` : ""}
                </span>
              </div>
              <TitleLink a={a} href={hrefFor(a.id)} selected={selected} onSelect={() => onSelect(a.id)} />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted">{a.organizer.name}</span>
                <span className="shrink-0 text-right">
                  <DeadlineCell a={a} now={now} />
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center">
              <SaveButton a={a} />
              <CompareCheckbox a={a} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
