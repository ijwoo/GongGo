"use client";

import { AlertTriangle, ArrowRight, List, RefreshCw, SearchX } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActiveFilters, FilterButton, FilterSheet, JobRoleChips, SortSelect } from "@/components/discover/filters";
import { CardGrid, CategoryNav, DiscoverHead, SectionHeader } from "@/components/discover/gallery";
import { ClosingSoon, MySchedule } from "@/components/discover/side-rail";
import { Button } from "@/components/ui/button";
import { pickOpenNow, pickRecent } from "@/domain/card";
import { DEFAULT_QUERY, filterAnnouncements, isCuratedQuery, serializeDiscoverQuery, type DiscoverQuery } from "@/domain/discover";
import { useDiscoverQuery } from "@/hooks/use-discover-query";
import { announcementHref } from "@/lib/announcement-href";
import { useAnnouncements, useAnnouncementsLoadError, useNow } from "@/lib/app-data";
import { rememberDiscoverQuery } from "@/lib/last-discover";

const MapMode = dynamic(() => import("@/components/discover/map-mode").then((m) => m.MapMode), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center text-[13px] text-muted">지도 화면을 불러오는 중…</div>,
});

/** 화면 폭: 최대 1400px, 좌우 여백은 넓어질수록 늘어난다 */
const FRAME = "mx-auto w-full max-w-[1480px] px-4 sm:px-6 lg:px-10";

export function DiscoverView() {
  const { query, setQuery } = useDiscoverQuery();
  const { list, byId } = useAnnouncements();
  const now = useNow();
  const router = useRouter();
  const loadError = useAnnouncementsLoadError();
  const [filterOpen, setFilterOpen] = useState(false);
  const results = useMemo(() => filterAnnouncements(list, query, now), [list, query, now]);

  // 다른 메뉴에 다녀와도 마지막 탐색 상태로 돌아올 수 있게 기억한다
  const serialized = serializeDiscoverQuery({ ...query, id: null });
  useEffect(() => rememberDiscoverQuery(serialized), [serialized]);

  // 예전 주소(/discover?id=…)는 목록 모드에서 상세 페이지로 보낸다. 지도 모드에서 id는 ‘선택한 마커’다
  useEffect(() => {
    if (query.view === "list" && query.id) router.replace(announcementHref(query.id));
  }, [query.view, query.id, router]);

  if (query.view === "map") {
    const selected = query.id ? (byId.get(query.id) ?? null) : null;
    return (
      <div className="flex h-[calc(100dvh-72px)] w-full min-w-0 flex-col bg-page">
        <h1 className="sr-only">지도로 공고 둘러보기</h1>
        <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2 lg:px-6">
          <Button onClick={() => setQuery({ view: "list", id: null, bbox: null })}>
            <List className="size-4" aria-hidden />
            목록으로 보기
          </Button>
          <p aria-live="polite" className="text-sm text-muted">
            조건에 맞는 공고 <b className="num text-fg">{results.length}</b>건
          </p>
          <div className="ml-auto flex items-center gap-2">
            <FilterButton query={query} setQuery={setQuery} open={filterOpen} onOpenChange={setFilterOpen} />
          </div>
        </div>
        <FilterSheet query={query} setQuery={setQuery} total={results.length} open={filterOpen} onOpenChange={setFilterOpen} />
        <section aria-label="지도 탐색" className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MapMode
            results={results}
            query={query}
            setQuery={setQuery}
            now={now}
            hrefFor={(id) => `/discover?${serializeDiscoverQuery({ ...query, id })}`}
            empty={<NoResults query={query} setQuery={setQuery} />}
            selected={selected}
            missing={query.id !== null && selected === null}
          />
        </section>
      </div>
    );
  }

  const curated = isCuratedQuery(query);
  const sortControls = (
    <>
      <FilterButton query={query} setQuery={setQuery} open={filterOpen} onOpenChange={setFilterOpen} />
      <SortSelect query={query} setQuery={(patch) => setQuery({ ...patch, all: true })} className="hidden md:flex" />
    </>
  );

  return (
    <div className={`${FRAME} pt-8 pb-16 md:pt-10`}>
      <DiscoverHead query={query} setQuery={setQuery} />
      <FilterSheet query={query} setQuery={setQuery} total={results.length} open={filterOpen} onOpenChange={setFilterOpen} />
      <div className="mt-7">
        <CategoryNav query={query} setQuery={setQuery} />
        {query.categories.length === 1 && query.categories[0] === "job" ? (
          <div className="mt-4">
            <JobRoleChips query={query} setQuery={setQuery} />
          </div>
        ) : null}
      </div>

      <div className="mt-9 grid grid-cols-1 gap-y-14 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-x-10 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {loadError ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
              <AlertTriangle className="size-7 text-warning" aria-hidden />
              <div>
                <p className="font-semibold">공고를 불러오지 못했어요</p>
                <p className="mt-1 text-sm text-muted">공고 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.</p>
              </div>
              <Button variant="primary" onClick={() => router.refresh()}>
                <RefreshCw className="size-4" aria-hidden />
                다시 시도
              </Button>
            </div>
          ) : results.length === 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <ActiveFilters query={query} setQuery={setQuery} />
                <div className="ml-auto flex items-center gap-2">{sortControls}</div>
              </div>
              <NoResults query={query} setQuery={setQuery} />
            </>
          ) : curated ? (
            <Curated results={results} now={now} setQuery={setQuery} sortControls={sortControls} />
          ) : (
            <section aria-labelledby="all-results-title">
              <SectionHeader
                id="all-results-title"
                eyebrow="검색·필터 결과"
                title={query.q ? `‘${query.q}’ 검색 결과` : "전체 공고"}
                actions={sortControls}
              />
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p aria-live="polite" className="text-sm text-muted">
                  공고 <b className="num text-[15px] text-fg">{results.length}</b>건
                </p>
                <ActiveFilters query={query} setQuery={setQuery} />
                <button
                  type="button"
                  onClick={() => setQuery({ ...DEFAULT_QUERY, categories: query.categories, regions: query.regions, online: query.online })}
                  className="text-sm font-medium text-accent-text hover:underline"
                >
                  검색·필터 지우기
                </button>
              </div>
              <CardGrid items={results} now={now} label="공고 목록" />
            </section>
          )}
        </div>

        <aside aria-label="마감·일정" className="grid min-w-0 content-start gap-10 md:grid-cols-2 md:gap-8 xl:grid-cols-1 xl:gap-10 xl:border-l xl:border-line xl:pl-10">
          <ClosingSoon list={list} now={now} />
          <MySchedule />
        </aside>
      </div>
    </div>
  );
}

function Curated({
  results,
  now,
  setQuery,
  sortControls,
}: {
  results: ReturnType<typeof filterAnnouncements>;
  now: string;
  setQuery: (patch: Partial<DiscoverQuery>, mode?: "push" | "replace") => void;
  sortControls: React.ReactNode;
}) {
  const openNow = pickOpenNow(results, now, 6);
  const recent = pickRecent(results, new Set(openNow.map((a) => a.id)), 3);
  return (
    <div className="space-y-14">
      {openNow.length ? (
        <section aria-labelledby="open-now-title">
          <SectionHeader id="open-now-title" eyebrow="신청할 수 있는 공고" title="지금 모집 중인 공고" description="행사가 가까운 순" actions={sortControls} />
          <CardGrid items={openNow} now={now} label="지금 신청할 수 있는 공고" />
        </section>
      ) : null}
      {recent.length ? (
        <section aria-labelledby="recent-title">
          <SectionHeader
            id="recent-title"
            eyebrow="최근 등록"
            title="새로 올라온 공고"
            description="등록이 최근인 순"
            actions={
              <>
                {openNow.length ? null : sortControls}
                <button
                  type="button"
                  onClick={() => setQuery({ all: true, sort: "recent" })}
                  className="inline-flex h-10 items-center gap-1 px-1 text-[15px] font-semibold text-accent-text hover:underline"
                >
                  모두 보기
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </>
            }
          />
          <CardGrid items={recent} now={now} label="새로 올라온 공고" />
        </section>
      ) : null}
      <div className="flex justify-center border-t border-line pt-8">
        <Button size="md" onClick={() => setQuery({ all: true })} className="h-11 px-5 text-[15px]">
          전체 공고 보기 <span className="num text-muted">{results.length}건</span>
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function NoResults({ query, setQuery }: { query: DiscoverQuery; setQuery: (patch: Partial<DiscoverQuery>) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <SearchX className="size-7 text-faint" aria-hidden />
      <div>
        <p className="font-semibold">조건에 맞는 공고가 없어요</p>
        <p className="mt-1 text-sm text-muted">지역을 넓히거나 조건을 줄여 보세요.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {!query.includeClosed ? <Button onClick={() => setQuery({ includeClosed: true, all: true })}>마감 공고 포함</Button> : null}
        <Button variant="primary" onClick={() => setQuery({ ...DEFAULT_QUERY, view: query.view })}>
          조건 초기화
        </Button>
      </div>
    </div>
  );
}
