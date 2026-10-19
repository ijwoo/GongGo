"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, List, Map as MapIcon, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { CATEGORY_LABEL, MODE_LABEL } from "@/domain/announcement";
import {
  activeFilterCount,
  DEFAULT_QUERY,
  VENUE_REGIONS,
  type DiscoverQuery,
  type Sort,
  type StatusFilter,
} from "@/domain/discover";
import { CATEGORIES, PARTICIPATION_MODES } from "@/domain/types";
import { cn } from "@/lib/cn";

type SetQuery = (patch: Partial<DiscoverQuery>, mode?: "push" | "replace") => void;

const STATUS_LABEL: Record<StatusFilter, string> = { all: "전체 상태", open: "접수 중", upcoming: "접수 예정", rolling: "상시 모집" };
const SORT_LABEL: Record<Sort, string> = { deadline: "마감 임박순", recent: "최근 등록순" };
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

/** 분야는 가장 자주 바꾸는 필터라 툴바에 탭처럼 바로 노출한다 */
function CategoryTabs({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const all = query.categories.length === 0;
  return (
    <div role="group" aria-label="분야" className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
      <button
        type="button"
        aria-pressed={all}
        onClick={() => setQuery({ categories: [], id: null })}
        className={cn(
          "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
          all ? "bg-fg text-page" : "text-muted hover:bg-hover hover:text-fg",
        )}
      >
        전체
      </button>
      {CATEGORIES.map((c) => {
        const on = query.categories.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => setQuery({ categories: toggle(query.categories, c), id: null })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition-colors",
              on ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-hover hover:text-fg",
            )}
          >
            {on ? <Check className="size-3.5" aria-hidden /> : null}
            {CATEGORY_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}

function SearchInput({ query, setQuery, className }: { query: DiscoverQuery; setQuery: SetQuery; className?: string }) {
  const [value, setValue] = useState(query.q);
  const [synced, setSynced] = useState(query.q);
  const timer = useRef<number | undefined>(undefined);
  if (query.q !== synced) {
    setSynced(query.q);
    setValue(query.q);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className={cn("relative min-w-0", className)}>
      <label htmlFor="discover-search" className="sr-only">
        결과 내 검색
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        id="discover-search"
        type="search"
        value={value}
        placeholder="공고명·기관·지역으로 찾기"
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          // 입력 중에는 history를 쌓지 않고 주소만 바꾼다
          timer.current = window.setTimeout(() => setQuery({ q: next.trim(), id: null }, "replace"), 250);
        }}
        className="h-9 w-full rounded-md border border-line bg-page pr-3 pl-9 text-sm placeholder:text-faint focus:border-accent focus:bg-panel focus:outline-none"
      />
    </div>
  );
}

export function ViewToggle({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  return (
    <div role="group" aria-label="보기 방식" className="inline-flex h-9 shrink-0 rounded-md bg-page p-0.5 ring-1 ring-line">
      {(["list", "map"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={query.view === v}
          onClick={() => setQuery({ view: v })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-semibold transition-colors",
            query.view === v ? "bg-elevated text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
          )}
        >
          {v === "list" ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
          {v === "list" ? "목록" : "지도"}
        </button>
      ))}
    </div>
  );
}

function SortSelect({ query, setQuery, className }: { query: DiscoverQuery; setQuery: SetQuery; className?: string }) {
  return (
    <label className={cn("items-center", className)}>
      <span className="sr-only">정렬</span>
      <select
        value={query.sort}
        onChange={(e) => setQuery({ sort: e.target.value as Sort })}
        className="h-9 rounded-md border border-line bg-panel px-2.5 text-[13px] font-semibold text-fg-2 hover:border-line-strong focus:border-accent focus:outline-none"
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

/** 지역·방식·상태·마감 포함. 팝오버(데스크톱)와 시트(모바일)가 같은 컨트롤을 쓴다 */
function MoreFilters({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const legend = "mb-2 block text-xs font-semibold text-muted";
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={legend}>행사 장소 지역</legend>
        <div className="flex flex-wrap gap-1.5">
          {VENUE_REGIONS.map((r) => (
            <Chip key={r} pressed={query.regions.includes(r)} onClick={() => setQuery({ regions: toggle(query.regions, r), id: null })}>
              {r}
            </Chip>
          ))}
        </div>
      </fieldset>
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
    </div>
  );
}

/** 적용 중인 필터를 하나씩 지울 수 있는 표시 */
function ActiveTokens({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const tokens: { key: string; label: string; clear: () => void }[] = [
    ...(query.q ? [{ key: "q", label: `‘${query.q}’`, clear: () => setQuery({ q: "" }) }] : []),
    ...(query.quick ? [{ key: "quick", label: QUICK_LABEL[query.quick], clear: () => setQuery({ quick: null }) }] : []),
    ...query.regions.map((r) => ({ key: `r-${r}`, label: r, clear: () => setQuery({ regions: query.regions.filter((x) => x !== r) }) })),
    ...query.modes.map((m) => ({ key: `m-${m}`, label: MODE_LABEL[m], clear: () => setQuery({ modes: query.modes.filter((x) => x !== m) }) })),
    ...(query.status !== "all" ? [{ key: "status", label: STATUS_LABEL[query.status], clear: () => setQuery({ status: "all" }) }] : []),
    ...(query.includeClosed ? [{ key: "closed", label: "마감·취소 포함", clear: () => setQuery({ includeClosed: false }) }] : []),
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

export function FilterBar({ query, setQuery, total }: { query: DiscoverQuery; setQuery: SetQuery; total: number }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = activeFilterCount(query);
  const moreCount = query.regions.length + query.modes.length + (query.status !== "all" ? 1 : 0) + (query.includeClosed ? 1 : 0);
  const reset = () => setQuery({ ...DEFAULT_QUERY, view: query.view });

  return (
    <div className="border-b border-line bg-panel">
      <div className="flex items-center gap-2 px-4 py-2.5 lg:gap-3 lg:px-6">
        <SearchInput query={query} setQuery={setQuery} className="w-full md:w-60 xl:w-72" />
        <span className="hidden h-5 w-px shrink-0 bg-line md:block" aria-hidden />
        <div className="hidden min-w-0 flex-1 md:block">
          <CategoryTabs query={query} setQuery={setQuery} />
        </div>
        <div className="hidden md:block">
        <Popover.Root modal={false}>
          <Popover.Trigger asChild>
            <Button aria-label={`필터${moreCount ? `, ${moreCount}개 적용됨` : ""}`}>
              <SlidersHorizontal className="size-4" aria-hidden />
              필터
              {moreCount ? (
                <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
                  {moreCount}
                </span>
              ) : null}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              aria-label="필터"
              className="z-40 w-[340px] rounded-lg border border-line bg-elevated p-4 shadow-[var(--shadow)]"
            >
              <MoreFilters query={query} setQuery={setQuery} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        </div>
        <div className="md:hidden">
        <Button onClick={() => setSheetOpen(true)} aria-label={`필터${count ? `, ${count}개 적용됨` : ""}`}>
          <SlidersHorizontal className="size-4" aria-hidden />
          필터{count ? <span className="num text-accent-text">{count}</span> : null}
        </Button>
        </div>
        <SortSelect query={query} setQuery={setQuery} className="hidden md:flex" />
        <ViewToggle query={query} setQuery={setQuery} />
      </div>
      <div className="flex min-h-10 flex-wrap items-center gap-2 border-t border-line px-4 py-2 text-[13px] lg:px-6">
        <p aria-live="polite" className="mr-1 text-muted">
          공고 <b className="num text-[15px] text-fg">{total}</b>건
        </p>
        <ActiveTokens query={query} setQuery={setQuery} />
        {count > 0 ? (
          <button type="button" onClick={reset} className="ml-1 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
            <RotateCcw className="size-3.5" aria-hidden />
            필터 초기화
          </button>
        ) : null}
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        side="bottom"
        title="필터"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={reset}>
              초기화
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setSheetOpen(false)}>
              공고 {total}건 보기
            </Button>
          </div>
        }
      >
        <div className="space-y-5 p-4">
          <fieldset>
            <legend className="mb-2 block text-xs font-semibold text-muted">분야</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Chip key={c} pressed={query.categories.includes(c)} onClick={() => setQuery({ categories: toggle(query.categories, c), id: null })}>
                  {CATEGORY_LABEL[c]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="w-14 font-semibold text-muted">정렬</span>
            <select
              value={query.sort}
              onChange={(e) => setQuery({ sort: e.target.value as Sort })}
              className="h-9 flex-1 rounded-md border border-line bg-panel px-2 text-[13px]"
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
    </div>
  );
}
