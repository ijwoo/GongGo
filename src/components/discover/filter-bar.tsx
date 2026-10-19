"use client";

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

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-[13px] font-medium transition-colors",
        pressed ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-panel text-fg hover:bg-subtle",
      )}
    >
      {pressed ? <Check className="size-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const STATUS_LABEL: Record<StatusFilter, string> = { all: "전체 상태", open: "접수 중", upcoming: "접수 예정", rolling: "상시 모집" };
const SORT_LABEL: Record<Sort, string> = { deadline: "마감 임박순", recent: "최근 등록순" };

function SearchInput({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const [value, setValue] = useState(query.q);
  const [synced, setSynced] = useState(query.q);
  const timer = useRef<number | undefined>(undefined);
  if (query.q !== synced) {
    setSynced(query.q);
    setValue(query.q);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="relative min-w-0 flex-1 md:max-w-80">
      <label htmlFor="discover-search" className="sr-only">
        결과 내 검색
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        id="discover-search"
        type="search"
        value={value}
        placeholder="공고명·기관·지역"
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          // 입력 중에는 history를 쌓지 않고 주소만 바꾼다
          timer.current = window.setTimeout(() => setQuery({ q: next.trim(), id: null }, "replace"), 250);
        }}
        className="h-9 w-full rounded-md border border-line bg-panel pr-3 pl-8 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
      />
    </div>
  );
}

export function ViewToggle({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  return (
    <div role="group" aria-label="보기 방식" className="inline-flex h-9 shrink-0 rounded-md border border-line bg-subtle p-0.5">
      {(["list", "map"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={query.view === v}
          onClick={() => setQuery({ view: v })}
          className={cn(
            "inline-flex items-center gap-1 rounded-[5px] px-2.5 text-[13px] font-semibold",
            query.view === v ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {v === "list" ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
          {v === "list" ? "목록" : "지도"}
        </button>
      ))}
    </div>
  );
}

function FilterControls({ query, setQuery, stacked }: { query: DiscoverQuery; setQuery: SetQuery; stacked?: boolean }) {
  const group = cn("flex flex-wrap items-center gap-1.5", stacked && "gap-2");
  const legend = cn("text-xs font-semibold text-muted", stacked ? "mb-2 block" : "sr-only");
  return (
    <div className={cn(stacked ? "space-y-5" : "flex flex-wrap items-center gap-x-4 gap-y-2")}>
      <fieldset>
        <legend className={legend}>분야</legend>
        <div className={group}>
          {CATEGORIES.map((c) => (
            <Chip key={c} pressed={query.categories.includes(c)} onClick={() => setQuery({ categories: toggle(query.categories, c), id: null })}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </fieldset>
      {!stacked && <span className="hidden h-5 w-px bg-line lg:block" aria-hidden />}
      <fieldset>
        <legend className={legend}>행사 장소 지역</legend>
        <div className={group}>
          {VENUE_REGIONS.map((r) => (
            <Chip key={r} pressed={query.regions.includes(r)} onClick={() => setQuery({ regions: toggle(query.regions, r), id: null })}>
              {r}
            </Chip>
          ))}
        </div>
      </fieldset>
      {!stacked && <span className="hidden h-5 w-px bg-line lg:block" aria-hidden />}
      <fieldset>
        <legend className={legend}>진행 방식</legend>
        <div className={group}>
          {PARTICIPATION_MODES.map((m) => (
            <Chip key={m} pressed={query.modes.includes(m)} onClick={() => setQuery({ modes: toggle(query.modes, m), id: null })}>
              {MODE_LABEL[m]}
            </Chip>
          ))}
        </div>
      </fieldset>
      {!stacked && <span className="hidden h-5 w-px bg-line lg:block" aria-hidden />}
      <div className={cn("flex flex-wrap items-center gap-3", stacked && "flex-col items-stretch")}>
        <label className="flex items-center gap-2 text-[13px]">
          <span className={stacked ? "w-16 font-semibold text-muted" : "sr-only"}>접수 상태</span>
          <select
            value={query.status}
            onChange={(e) => setQuery({ status: e.target.value as StatusFilter, id: null })}
            className="h-8 flex-1 rounded-md border border-line bg-panel px-2 text-[13px] focus:border-accent focus:outline-none"
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-8 cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={query.includeClosed}
            onChange={(e) => setQuery({ includeClosed: e.target.checked, id: null })}
            className="size-4 accent-[var(--accent)]"
          />
          마감·취소 공고 포함
        </label>
      </div>
    </div>
  );
}

const QUICK_LABEL = { today: "오늘 등록된 공고", week: "이번 주 마감" } as const;

export function FilterBar({ query, setQuery, total }: { query: DiscoverQuery; setQuery: SetQuery; total: number }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = activeFilterCount(query);
  const reset = () => setQuery({ ...DEFAULT_QUERY, view: query.view });

  return (
    <div className="border-b border-line bg-panel">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <SearchInput query={query} setQuery={setQuery} />
        <Button className="md:hidden" onClick={() => setSheetOpen(true)} aria-label={`필터${count ? `, ${count}개 적용됨` : ""}`}>
          <SlidersHorizontal className="size-4" aria-hidden />
          필터{count ? <span className="num text-accent-text">{count}</span> : null}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <label className="hidden items-center md:flex">
            <span className="sr-only">정렬</span>
            <select
              value={query.sort}
              onChange={(e) => setQuery({ sort: e.target.value as Sort })}
              className="h-9 rounded-md border border-line bg-panel px-2 text-[13px] focus:border-accent focus:outline-none"
            >
              {Object.entries(SORT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <ViewToggle query={query} setQuery={setQuery} />
        </div>
      </div>
      <div className="hidden px-4 pb-3 md:block">
        <FilterControls query={query} setQuery={setQuery} />
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-2 border-t border-line px-4 py-1.5 text-[13px]">
        <p aria-live="polite" className="text-muted">
          공고 <b className="num text-fg">{total}</b>건
        </p>
        {query.quick ? (
          <button
            type="button"
            onClick={() => setQuery({ quick: null })}
            className="inline-flex h-6 items-center gap-1 rounded-sm bg-accent-soft px-2 text-xs font-semibold text-accent-text"
            aria-label={`${QUICK_LABEL[query.quick]} 필터 해제`}
          >
            {QUICK_LABEL[query.quick]}
            <X className="size-3" aria-hidden />
          </button>
        ) : null}
        {count > 0 ? (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-muted hover:text-fg">
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
          <label className="flex items-center gap-2 text-[13px]">
            <span className="w-16 font-semibold text-muted">정렬</span>
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
          <FilterControls query={query} setQuery={setQuery} stacked />
        </div>
      </Sheet>
    </div>
  );
}
