"use client";

import { MapPinOff, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORY_LABEL, hasCoordinates, venueShort } from "@/domain/announcement";
import { withinBbox, type DiscoverQuery } from "@/domain/discover";
import type { Announcement } from "@/domain/types";
import { cn } from "@/lib/cn";
import { MapCanvas } from "./map-canvas";
import { SaveButton } from "./save-button";
import { DeadlineCell, StateBadge } from "./status";

/**
 * 지도 모드. 목록(현재 범위) | 지도 | 상세(바깥 패널) 3열.
 * 지도와 왼쪽 목록은 같은 결과(필터 결과 ∩ 지도 범위 ∩ 장소 확정)를 쓴다.
 */
export function MapMode({
  results,
  query,
  setQuery,
  now,
  hrefFor,
  empty,
}: {
  results: Announcement[];
  query: DiscoverQuery;
  setQuery: (patch: Partial<DiscoverQuery>, mode?: "push" | "replace") => void;
  now: string;
  hrefFor: (id: string) => string;
  empty: ReactNode;
}) {
  const located = withinBbox(results, query.bbox);
  const unlocated = results.filter((a) => !hasCoordinates(a));
  const select = (id: string) => setQuery({ id }, "replace");

  return (
    <div className="flex min-h-0 flex-1">
      <div className="hidden w-[40%] max-w-[440px] min-w-[300px] shrink-0 flex-col border-r border-line md:flex xl:w-[42%]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[13px]">
          <p>
            {query.bbox ? "이 지역" : "지도"}의 공고 <b className="num">{located.length}</b>건
          </p>
          {query.bbox ? (
            <button
              type="button"
              onClick={() => setQuery({ bbox: null })}
              className="ml-auto inline-flex h-6 items-center gap-1 rounded-sm bg-accent-soft px-2 text-xs font-semibold text-accent-text"
            >
              지역 범위 해제
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {results.length === 0 ? (
            empty
          ) : located.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted">이 지역에는 조건에 맞는 공고가 없어요. 지도를 옮기거나 범위를 해제해 보세요.</p>
          ) : (
            <ul className="divide-y divide-line" aria-label="지도 범위의 공고 목록">
              {located.map((a) => {
                const selected = a.id === query.id;
                return (
                  <li key={a.id} className={cn("flex gap-2 px-3 py-2.5", selected ? "bg-accent-soft" : "hover:bg-subtle")}>
                    <SaveButton a={a} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={hrefFor(a.id)}
                        replace
                        scroll={false}
                        aria-current={selected ? "true" : undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) return;
                          e.preventDefault();
                          select(a.id);
                        }}
                        className="line-clamp-2 text-[13px] font-semibold hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <StateBadge a={a} now={now} />
                        {CATEGORY_LABEL[a.category]} · {venueShort(a)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <DeadlineCell a={a} now={now} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {unlocated.length > 0 ? (
            <div className="flex items-start gap-2 border-t border-line px-4 py-3 text-xs text-muted">
              <MapPinOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <p>
                온라인·장소 미정 공고 {unlocated.length}건은 지도에 표시하지 않아요.{" "}
                <button type="button" className="font-semibold text-accent-text hover:underline" onClick={() => setQuery({ view: "list", bbox: null })}>
                  목록에서 보기
                </button>
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <MapCanvas
          items={located.length || !query.bbox ? located : []}
          selectedId={query.id}
          onSelect={select}
          appliedBbox={query.bbox}
          onSearchArea={(bbox) => setQuery({ bbox })}
          onShowList={() => setQuery({ view: "list" })}
        />
        <p className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded-sm bg-panel/95 px-2 py-1 text-xs shadow-sm md:hidden">
          지도의 공고 <b className="num">{located.length}</b>건 · 온라인·미정 {unlocated.length}건 제외
        </p>
      </div>
    </div>
  );
}
