"use client";

import { SearchX } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AnnouncementCompactList, AnnouncementTable } from "@/components/discover/announcement-list";
import { DetailHost } from "@/components/discover/detail-host";
import { FilterBar } from "@/components/discover/filter-bar";
import { DEFAULT_QUERY, filterAnnouncements, serializeDiscoverQuery } from "@/domain/discover";
import { useDiscoverQuery } from "@/hooks/use-discover-query";
import { useAnnouncements, useNow } from "@/lib/app-data";
import { rememberDiscoverQuery } from "@/lib/last-discover";

const MapMode = dynamic(() => import("@/components/discover/map-mode").then((m) => m.MapMode), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center text-[13px] text-muted">지도 화면을 불러오는 중…</div>,
});

export function DiscoverView() {
  const { query, setQuery, hrefFor } = useDiscoverQuery();
  const { list, byId } = useAnnouncements();
  const now = useNow();
  const results = useMemo(() => filterAnnouncements(list, query, now), [list, query, now]);
  const selected = query.id ? (byId.get(query.id) ?? null) : null;
  const missing = query.id !== null && selected === null;

  // 다른 메뉴에 다녀와도 마지막 탐색 상태로 돌아올 수 있게 기억한다
  const serialized = serializeDiscoverQuery(query);
  useEffect(() => rememberDiscoverQuery(serialized), [serialized]);

  const select = (id: string | null) => setQuery({ id }, "replace");
  const linkFor = (id: string) => hrefFor({ id });

  // 주소로 바로 들어왔을 때 선택한 행이 보이도록 스크롤한다
  const listRef = useRef<HTMLDivElement>(null);
  const initialId = useRef(query.id);
  useEffect(() => {
    if (!initialId.current) return;
    // scrollIntoView는 창 전체까지 움직이므로 목록 영역만 직접 스크롤한다
    const box = listRef.current;
    const row = box?.querySelector<HTMLElement>('[aria-current="true"]')?.closest<HTMLElement>("tr, li");
    if (box && row) box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
    initialId.current = null;
  }, []);

  const empty = (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <SearchX className="size-7 text-faint" aria-hidden />
      <div>
        <p className="font-semibold">조건에 맞는 공고가 없어요</p>
        <p className="mt-1 text-[13px] text-muted">필터를 줄이거나 마감된 공고까지 포함해 보세요.</p>
      </div>
      <div className="flex gap-2">
        {!query.includeClosed ? <Button onClick={() => setQuery({ includeClosed: true })}>마감 공고 포함</Button> : null}
        <Button variant="primary" onClick={() => setQuery({ ...DEFAULT_QUERY, view: query.view })}>
          필터 초기화
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-96px)] max-w-[1680px] min-w-0">
      <section aria-label="공고 탐색" className="flex min-w-0 flex-1 flex-col bg-panel">
        <h1 className="sr-only">공고 발견</h1>
        <FilterBar query={query} setQuery={setQuery} total={results.length} />
        {query.view === "list" ? (
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {results.length === 0 ? (
              empty
            ) : (
              <>
                <div className="hidden md:block">
                  <AnnouncementTable items={results} now={now} selectedId={query.id} hrefFor={linkFor} onSelect={select} />
                </div>
                <div className="md:hidden">
                  <AnnouncementCompactList items={results} now={now} selectedId={query.id} hrefFor={linkFor} onSelect={select} />
                </div>
              </>
            )}
          </div>
        ) : (
          <MapMode results={results} query={query} setQuery={setQuery} now={now} hrefFor={linkFor} empty={empty} />
        )}
      </section>
      <DetailHost
        selected={selected}
        missing={missing}
        onClose={() => select(null)}
        panelBreakpoint={query.view === "map" ? "(min-width: 1280px)" : "(min-width: 1180px)"}
        panelClassName={query.view === "map" ? "hidden xl:block w-[28%] min-w-[340px] max-w-[440px]" : "hidden min-[1180px]:block w-[400px] shrink-0"}
      />
    </div>
  );
}
