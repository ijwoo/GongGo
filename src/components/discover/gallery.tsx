"use client";

import { BookOpen, BriefcaseBusiness, ChevronDown, LayoutGrid, MapPin, Sprout, Users, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_LABEL } from "@/domain/announcement";
import { VENUE_REGIONS, type DiscoverQuery } from "@/domain/discover";
import { CATEGORIES, type Announcement, type Category } from "@/domain/types";
import { cn } from "@/lib/cn";
import { AnnouncementCard } from "./announcement-card";
import type { SetQuery } from "./filters";

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  hackathon: Zap,
  event: Users,
  education: BookOpen,
  startup: Sprout,
  job: BriefcaseBusiness,
};
/** 목업 순서: 해커톤 → 개발자 행사 → 교육·워크숍 → 창업 지원 (+ 데이터에 있는 채용) */
const CATEGORY_ORDER: Category[] = ["hackathon", "event", "education", "startup", "job"];

const CAPITAL = ["서울", "경기"] as const;

function regionValue(regions: string[]): string {
  if (regions.length === 0) return "all";
  if (regions.length === 2 && CAPITAL.every((r) => regions.includes(r))) return "capital";
  if (regions.length === 1) return regions[0];
  return "custom";
}

/** 지역 선택 + 온라인 포함 + 제목 + 지도로 보기 */
export function DiscoverHead({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const value = regionValue(query.regions);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-2">
          <label className="relative inline-flex items-center">
            <span className="sr-only">행사 장소 지역</span>
            <select
              value={value}
              onChange={(e) => {
                const v = e.target.value;
                setQuery({ regions: v === "all" ? [] : v === "capital" ? [...CAPITAL] : v === "custom" ? query.regions : [v as (typeof VENUE_REGIONS)[number]], id: null });
              }}
              className="h-9 appearance-none rounded-md bg-transparent pr-6 pl-1 font-medium hover:bg-hover focus:outline-none focus-visible:outline-2"
            >
              <option value="all">전국</option>
              <option value="capital">서울·경기</option>
              {VENUE_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              {value === "custom" ? <option value="custom">{query.regions.join("·")}</option> : null}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 size-4 text-muted" aria-hidden />
          </label>
          <span className="h-4 w-px bg-line-strong" aria-hidden />
          <button
            type="button"
            role="switch"
            aria-checked={query.online}
            onClick={() => setQuery({ online: !query.online, id: null })}
            className="inline-flex h-9 items-center gap-2 rounded-md px-1 font-medium hover:bg-hover"
          >
            <span
              aria-hidden
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                query.online ? "bg-accent" : "bg-line-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left]",
                  query.online ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
            온라인 포함
          </button>
        </div>
        <h1 className="mt-3 text-[28px] leading-tight font-bold tracking-[-0.02em] break-keep text-fg md:text-[34px]">다음 도전을 발견하세요.</h1>
        <p className="mt-2 text-base text-muted md:text-[17px]">함께 만들고, 배우고, 성장할 기회를 모았어요.</p>
      </div>
      <button
        type="button"
        onClick={() => setQuery({ view: "map", id: null })}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-accent px-4 text-[15px] font-semibold text-accent-text hover:bg-accent-soft"
      >
        <MapPin className="size-[18px]" aria-hidden />
        지도로 보기
      </button>
    </div>
  );
}

/** 분야 탭. 하나만 고른다(여러 개는 URL로만 가능하며 그때는 ‘전체’가 꺼진다) */
export function CategoryNav({ query, setQuery }: { query: DiscoverQuery; setQuery: SetQuery }) {
  const items: { key: string; label: string; icon: LucideIcon; active: boolean; onClick: () => void }[] = [
    { key: "all", label: "전체", icon: LayoutGrid, active: query.categories.length === 0, onClick: () => setQuery({ categories: [], id: null }) },
    ...CATEGORY_ORDER.filter((c) => CATEGORIES.includes(c)).map((c) => ({
      key: c,
      label: CATEGORY_LABEL[c],
      icon: CATEGORY_ICON[c],
      active: query.categories.length === 1 && query.categories[0] === c,
      onClick: () => setQuery({ categories: [c], id: null }),
    })),
  ];
  return (
    <nav aria-label="분야" className="border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] md:gap-3">
        {items.map(({ key, label, icon: Icon, active, onClick }) => (
          <li key={key} className="shrink-0">
            <button
              type="button"
              aria-pressed={active}
              onClick={onClick}
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-t-lg border-b-2 px-4 text-[15px] whitespace-nowrap transition-colors md:px-5",
                active ? "border-accent bg-accent-soft font-semibold text-accent-text" : "border-transparent font-medium text-muted hover:text-fg",
              )}
            >
              <Icon className="size-5" strokeWidth={1.8} aria-hidden />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SectionHeader({ id, title, description, actions }: { id: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-[22px] leading-tight font-bold tracking-[-0.01em]">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardGrid({ items, now, label }: { items: Announcement[]; now: string; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <li key={a.id} className="min-w-0">
          <AnnouncementCard a={a} now={now} />
        </li>
      ))}
    </ul>
  );
}
