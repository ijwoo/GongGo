"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { MODE_LABEL } from "@/domain/announcement";
import {
  activeFilterCount,
  DEFAULT_QUERY,
  jobFilterCount,
  type DiscoverQuery,
  type Sort,
  type StatusFilter,
} from "@/domain/discover";
import {
  COMPANY_SIZE_LABEL,
  COMPANY_SIZES,
  JOB_LEVEL_LABEL,
  JOB_LEVELS,
  JOB_ROLE_LABEL,
  JOB_ROLES,
  jobCompanies,
} from "@/domain/job";
import { PARTICIPATION_MODES } from "@/domain/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useAnnouncements } from "@/lib/app-data";
import { cn } from "@/lib/cn";

export type SetQuery = (patch: Partial<DiscoverQuery>, mode?: "push" | "replace") => void;

const STATUS_LABEL: Record<StatusFilter, string> = { all: "전체 상태", open: "접수 중", upcoming: "접수 예정", rolling: "상시 모집" };
export const SORT_LABEL: Record<Sort, string> = { deadline: "마감 임박순", recent: "최근 등록순" };
const QUICK_LABEL = { today: "오늘 등록된 공고", week: "이번 주 마감" } as const;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ pressed, onClick, children, size = "md" }: { pressed: boolean; onClick: () => void; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold transition-colors",
        size === "md" ? "h-8 px-3 text-[13px]" : "h-7 px-2.5 text-xs",
        pressed ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-panel text-fg-2 hover:border-line-strong hover:bg-hover",
      )}
    >
      {pressed ? <Check className="size-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function SortSelect({ query, setQuery, className }: { query: DiscoverQuery; setQuery: SetQuery; className?: string }) {
  return (
    <label className={cn("items-center", className)}>
      <span className="sr-only">정렬</span>
      <select
        value={query.sort}
        onChange={(e) => setQuery({ sort: e.target.value as Sort })}
        className="h-10 rounded-lg border border-line bg-panel px-3 text-sm font-medium text-fg-2 hover:border-line-strong focus:border-accent focus:outline-none"
      >
        {Object.entries(SORT_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 직무 칩 한 줄. 채용 분야를 고른 화면 위쪽에 바로 보인다 */
export function JobRoleChips({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="직무">
      <Chip pressed={query.roles.length === 0} onClick={() => setQuery({ roles: [], id: null })}>
        전체 직무
      </Chip>
      {JOB_ROLES.map((r) => (
        <Chip key={r} pressed={query.roles.includes(r)} onClick={() => setQuery({ roles: toggle(query.roles, r), id: null })}>
          {JOB_ROLE_LABEL[r]}
        </Chip>
      ))}
    </div>
  );
}

/** 채용 조건: 직무·경력·기업 규모·회사. 하나라도 고르면 채용 공고만 보인다 */
function JobFilters({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const { list } = useAnnouncements();
  const companies = jobCompanies(list);
  const legend = "mb-2 block text-xs font-semibold text-muted";
  return (
    <div className="space-y-4 rounded-lg border border-line p-3">
      <p className="text-[13px] font-bold">
        채용 조건 <span className="font-normal text-muted">· 고르면 채용 공고만 보여요</span>
      </p>
      <fieldset>
        <legend className={legend}>직무</legend>
        <div className="flex flex-wrap gap-1.5">
          {JOB_ROLES.map((r) => (
            <Chip key={r} size="sm" pressed={query.roles.includes(r)} onClick={() => setQuery({ roles: toggle(query.roles, r), id: null })}>
              {JOB_ROLE_LABEL[r]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={legend}>경력</legend>
        <div className="flex flex-wrap gap-1.5">
          {JOB_LEVELS.map((l) => (
            <Chip key={l} size="sm" pressed={query.levels.includes(l)} onClick={() => setQuery({ levels: toggle(query.levels, l), id: null })}>
              {JOB_LEVEL_LABEL[l]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={legend}>기업 규모</legend>
        <div className="flex flex-wrap gap-1.5">
          {COMPANY_SIZES.map((z) => (
            <Chip key={z} size="sm" pressed={query.sizes.includes(z)} onClick={() => setQuery({ sizes: toggle(query.sizes, z), id: null })}>
              {COMPANY_SIZE_LABEL[z]}
            </Chip>
          ))}
        </div>
      </fieldset>
      {companies.length ? (
        <fieldset>
          <legend className={legend}>회사</legend>
          <div className="flex flex-wrap gap-1.5">
            {companies.map((c) => (
              <Chip
                key={c.name}
                size="sm"
                pressed={query.companies.includes(c.name)}
                onClick={() => setQuery({ companies: toggle(query.companies, c.name), id: null })}
              >
                {c.name} <span className="num font-normal text-muted">{c.count}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}
      <p className="text-[11px] text-faint">직무·경력은 공고 제목으로 분류해요. 제목에 단서가 없으면 해당 조건에서 빠질 수 있어요.</p>
    </div>
  );
}

/** 방식·상태·마감 포함. 팝오버(데스크톱)와 시트(모바일)가 같은 컨트롤을 쓴다. 지역·온라인은 화면 위쪽에서 고른다 */
function MoreFilters({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const legend = "mb-2 block text-xs font-semibold text-muted";
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={legend}>진행 방식</legend>
        <div className="flex flex-wrap gap-1.5">
          {PARTICIPATION_MODES.map((m) => (
            <Chip key={m} pressed={query.modes.includes(m)} onClick={() => setQuery({ modes: toggle(query.modes, m), id: null })}>
              {MODE_LABEL[m]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={legend}>접수 상태</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => (
            <Chip key={s} pressed={query.status === s} onClick={() => setQuery({ status: s, id: null })}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
        <input
          type="checkbox"
          checked={query.includeClosed}
          onChange={(e) => setQuery({ includeClosed: e.target.checked, id: null })}
          className="size-4 accent-[var(--accent)]"
        />
        마감·취소 공고 포함
      </label>
      {query.categories.length === 0 || query.categories.includes("job") ? <JobFilters query={query} setQuery={setQuery} /> : null}
    </div>
  );
}

/** 적용 중인 필터를 하나씩 지울 수 있는 표시 */
export function ActiveTokens({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const tokens: { key: string; label: string; clear: () => void }[] = [
    ...(query.q ? [{ key: "q", label: `‘${query.q}’`, clear: () => setQuery({ q: "" }) }] : []),
    ...(query.quick ? [{ key: "quick", label: QUICK_LABEL[query.quick], clear: () => setQuery({ quick: null }) }] : []),
    ...(query.online ? [] : [{ key: "online", label: "온라인 제외", clear: () => setQuery({ online: true }) }]),
    ...query.modes.map((m) => ({ key: `m-${m}`, label: MODE_LABEL[m], clear: () => setQuery({ modes: query.modes.filter((x) => x !== m) }) })),
    ...(query.status !== "all" ? [{ key: "status", label: STATUS_LABEL[query.status], clear: () => setQuery({ status: "all" }) }] : []),
    ...(query.includeClosed ? [{ key: "closed", label: "마감·취소 포함", clear: () => setQuery({ includeClosed: false }) }] : []),
    ...query.roles.map((r) => ({ key: `r-${r}`, label: JOB_ROLE_LABEL[r], clear: () => setQuery({ roles: query.roles.filter((x) => x !== r) }) })),
    ...query.levels.map((l) => ({ key: `l-${l}`, label: JOB_LEVEL_LABEL[l], clear: () => setQuery({ levels: query.levels.filter((x) => x !== l) }) })),
    ...query.sizes.map((z) => ({ key: `s-${z}`, label: COMPANY_SIZE_LABEL[z], clear: () => setQuery({ sizes: query.sizes.filter((x) => x !== z) }) })),
    ...query.companies.map((c) => ({ key: `c-${c}`, label: c, clear: () => setQuery({ companies: query.companies.filter((x) => x !== c) }) })),
  ];
  return (
    <>
      {tokens.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={t.clear}
          aria-label={`${t.label} 필터 해제`}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm bg-accent-soft px-2 text-xs font-semibold text-accent-text hover:brightness-110"
        >
          {t.label}
          <X className="size-3" aria-hidden />
        </button>
      ))}
    </>
  );
}

/**
 * ‘필터’ 버튼. 넓은 화면은 팝오버, 좁은 화면은 아래에서 올라오는 시트(FilterSheet).
 * 열림 상태는 화면이 가진다. 조건을 바꾸면 큐레이션 ↔ 결과 그리드로 버튼 위치가 바뀌어도 닫히지 않게 하려는 것이다.
 */
export function FilterButton({
  query,
  setQuery,
  open,
  onOpenChange,
}: {
  query: DiscoverQuery;
  setQuery: SetQuery;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  const moreCount = query.modes.length + (query.status !== "all" ? 1 : 0) + (query.includeClosed ? 1 : 0) + jobFilterCount(query);
  const label = `필터${moreCount ? `, ${moreCount}개 적용됨` : ""}`;
  return (
    <Popover.Root modal={false} open={open && wide} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            if (wide) return; // 팝오버는 Root가 연다
            e.preventDefault();
            onOpenChange(true);
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-panel px-3.5 text-sm font-medium text-fg-2 hover:border-line-strong hover:bg-hover"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          필터
          {moreCount ? (
            <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
              {moreCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="필터"
          className="z-40 max-h-[min(80dvh,720px)] w-[380px] overflow-y-auto rounded-lg border border-line bg-elevated p-4 shadow-[var(--shadow)]"
        >
          <MoreFilters query={query} setQuery={setQuery} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** 좁은 화면의 필터 시트. 화면에서 한 번만 그린다 */
export function FilterSheet({
  query,
  setQuery,
  total,
  open,
  onOpenChange,
}: {
  query: DiscoverQuery;
  setQuery: SetQuery;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  return (
    <Sheet
      open={open && !wide}
      onOpenChange={onOpenChange}
      side="bottom"
      title="필터"
      footer={
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => setQuery({ ...DEFAULT_QUERY, categories: query.categories, regions: query.regions, online: query.online, view: query.view })}
          >
            초기화
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => onOpenChange(false)}>
            공고 {total}건 보기
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-4">
        <label className="flex items-center gap-2 text-[13px]">
          <span className="w-14 font-semibold text-muted">정렬</span>
          <select
            value={query.sort}
            onChange={(e) => setQuery({ sort: e.target.value as Sort, all: true })}
            className="h-10 flex-1 rounded-lg border border-line bg-panel px-2 text-sm"
          >
            {Object.entries(SORT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <MoreFilters query={query} setQuery={setQuery} />
      </div>
    </Sheet>
  );
}

/** 적용 중인 세부 조건과 초기화. 조건이 없으면 아무것도 그리지 않는다 */
export function ActiveFilters({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const count = activeFilterCount(query) - query.regions.length - query.categories.length;
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActiveTokens query={query} setQuery={setQuery} />
      <button
        type="button"
        onClick={() => setQuery({ ...DEFAULT_QUERY, categories: query.categories, regions: query.regions, view: query.view, all: query.all })}
        className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        조건 초기화
      </button>
    </div>
  );
}
