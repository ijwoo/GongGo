"use client";

import { ChevronLeft, List, MapPinOff, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CATEGORY_LABEL, hasCoordinates, mapPointOf, venueShort } from "@/domain/announcement";
import { withinBbox, type DiscoverQuery } from "@/domain/discover";
import type { Announcement } from "@/domain/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { DetailHost } from "./detail-host";
import { MapCanvas } from "./map-canvas";
import { SaveButton } from "./save-button";
import { DeadlineCell, StateBadge } from "./status";

/** 떠 있는 패널 너비(px). 지도는 이만큼을 비우고 공고를 맞춰 보여 준다. 아주 넓은 화면에서만 조금 넓힌다 */
const LIST_WIDTH = { base: 360, wide: 392 };
const DETAIL_WIDTH = { base: 420, wide: 440 };
const GAP = 12;

/**
 * 지도 모드. 지도가 화면 전체를 쓰고, 목록(현재 범위)과 상세는 지도 위에 뜬 패널이다.
 * 목록은 접을 수 있고, 상세는 공고를 고를 때만 열린다(좁은 화면은 서랍·바텀시트).
 * 지도와 왼쪽 목록은 같은 결과(필터 결과 ∩ 지도 범위 ∩ 위치 있음)를 쓴다.
 * 위치는 확정된 행사 장소이거나, 시·구 단위로만 알려진 지역의 대략 위치다.
 */
export function MapMode({
  results,
  query,
  setQuery,
  now,
  hrefFor,
  empty,
  selected,
  missing,
}: {
  results: Announcement[];
  query: DiscoverQuery;
  setQuery: (patch: Partial<DiscoverQuery>, mode?: "push" | "replace") => void;
  now: string;
  hrefFor: (id: string) => string;
  empty: ReactNode;
  selected: Announcement | null;
  missing: boolean;
}) {
  const located = withinBbox(results, query.bbox);
  const unlocated = results.filter((a) => !hasCoordinates(a));
  const select = (id: string) => setQuery({ id }, "replace");
  const [listOpen, setListOpen] = useState(true);
  /** 같은 장소 마커로 고른 공고. 있으면 목록을 그 공고로 좁힌다 */
  const [picked, setPicked] = useState<string[] | null>(null);
  const pickedSet = picked ? new Set(picked) : null;
  const pickedShown = pickedSet ? located.filter((a) => pickedSet.has(a.id)) : [];
  // 필터를 바꿔 고른 공고가 모두 빠지면 고르기 전 목록으로 돌아간다
  const shown = pickedShown.length ? pickedShown : located;
  const pickedPlace = pickedShown.length ? placeLabel(pickedShown[0]) : null;
  const pickedArea = pickedShown.length > 0 && mapPointOf(pickedShown[0])?.precision === "area";
  const md = useMediaQuery("(min-width: 768px)");
  const lg = useMediaQuery("(min-width: 1024px)");
  const wide = useMediaQuery("(min-width: 1536px)");
  const listWidth = wide ? LIST_WIDTH.wide : LIST_WIDTH.base;
  const detailWidth = wide ? DETAIL_WIDTH.wide : DETAIL_WIDTH.base;
  const showList = md && listOpen;
  const showDetail = lg && (selected !== null || missing);

  return (
    <div className="relative min-h-0 flex-1">
      <MapCanvas
        items={located.length || !query.bbox ? located : []}
        selectedId={query.id}
        onSelect={select}
        onPickPlace={(ids) => {
          setPicked(ids);
          setListOpen(true);
        }}
        pickedIds={pickedShown.length ? picked : null}
        appliedBbox={query.bbox}
        onSearchArea={(bbox) => setQuery({ bbox })}
        onShowList={() => setQuery({ view: "list" })}
        insetLeft={showList ? listWidth + GAP * 2 : 0}
        insetRight={showDetail ? detailWidth + GAP * 2 : 0}
      />

      {md && !listOpen ? (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="absolute top-3 left-3 z-[4] inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-panel px-4 text-[13px] font-semibold shadow-[var(--shadow)] hover:bg-subtle"
        >
          <List className="size-4" aria-hidden />
          목록 <span className="num text-accent-text">{located.length}</span>
        </button>
      ) : null}

      <div
        hidden={!showList}
        style={{ width: listWidth }}
        className="absolute top-3 bottom-3 left-3 z-[4] flex flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow)]"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm">
              {pickedPlace ?? (query.bbox ? "이 지역" : "지도")}
              {pickedArea ? " 내" : "의"} 공고 <b className="num text-accent-text">{shown.length}</b>건
            </p>
            {pickedArea ? <p className="text-xs text-muted">정확한 장소 미확인 · 시·구 단위 대략 위치</p> : null}
          </div>
          {pickedPlace ? (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 text-xs font-semibold text-accent-text"
            >
              전체 보기
              <X className="size-3" aria-hidden />
            </button>
          ) : query.bbox ? (
            <button
              type="button"
              onClick={() => setQuery({ bbox: null })}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-accent-soft px-2 text-xs font-semibold text-accent-text"
            >
              범위 해제
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setListOpen(false)}
            aria-label="목록 접기"
            title="목록 접기"
            className="ml-auto inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-subtle"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {results.length === 0 ? (
            empty
          ) : shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted">이 지역에는 조건에 맞는 공고가 없어요. 지도를 옮기거나 범위를 해제해 보세요.</p>
          ) : (
            <ul className="space-y-1 p-2" aria-label="지도 범위의 공고 목록">
              {shown.map((a) => {
                const isSelected = a.id === query.id;
                const area = mapPointOf(a)?.precision === "area";
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "relative flex gap-2 rounded-lg px-2.5 py-2.5",
                      isSelected ? "bg-accent-soft before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-accent" : "hover:bg-subtle",
                    )}
                  >
                    <SaveButton a={a} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={hrefFor(a.id)}
                        replace
                        scroll={false}
                        aria-current={isSelected ? "true" : undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) return;
                          e.preventDefault();
                          select(a.id);
                        }}
                        className="line-clamp-2 text-sm leading-snug font-semibold break-keep hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted">
                        <span className="font-semibold text-accent-text">{a.category === "job" ? a.organizer.name : CATEGORY_LABEL[a.category]}</span>
                        <span aria-hidden> · </span>
                        {venueShort(a)}
                        {area ? " · 대략 위치" : ""}
                      </p>
                      <p className="mt-1">
                        <StateBadge a={a} now={now} />
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
                온라인이거나 지역을 알 수 없는 공고 {unlocated.length}건은 지도에 표시하지 않아요.{" "}
                <button type="button" className="font-semibold text-accent-text hover:underline" onClick={() => setQuery({ view: "list", bbox: null })}>
                  목록에서 보기
                </button>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <DetailHost
        selected={selected}
        missing={missing}
        onClose={() => setQuery({ id: null }, "replace")}
        panelBreakpoint="(min-width: 1024px)"
        floating
        panelClassName={cn("absolute top-3 right-3 bottom-3 z-[4]", !showDetail && "hidden")}
        panelStyle={{ width: detailWidth }}
      />

      <p className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded-full bg-panel/95 px-3 py-1 text-xs shadow-sm md:hidden">
        지도의 공고 <b className="num">{located.length}</b>건 · 온라인·지역 미상 {unlocated.length}건 제외
      </p>
    </div>
  );
}

/** 같은 장소 묶음의 이름: 확정 장소면 장소 이름, 아니면 시·구 */
function placeLabel(a: Announcement): string {
  const v = a.venue;
  if (v.status === "confirmed") return v.name;
  if (v.status === "tbd" && v.area) return v.area.label;
  return "이 장소";
}
