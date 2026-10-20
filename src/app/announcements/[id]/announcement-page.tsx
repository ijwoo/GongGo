"use client";

import { ArrowLeft, FileSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnnouncementDetail } from "@/components/discover/announcement-detail";
import { buttonClass } from "@/components/ui/button";
import { consumeOpenedFromDiscover } from "@/lib/announcement-href";
import { useAnnouncements } from "@/lib/app-data";
import { useDiscoverHref } from "@/lib/last-discover";

/**
 * 공고 상세 페이지. 주소로 바로 들어오거나 새로고침해도 같은 화면이 나온다.
 * 둘러보기에서 왔다면 ‘목록으로’가 브라우저 뒤로 가기를 써서 검색·필터·스크롤을 그대로 되살린다.
 */
export function AnnouncementPage({ id }: { id: string }) {
  const { byId } = useAnnouncements();
  const a = byId.get(id) ?? null;
  const router = useRouter();
  const discoverHref = useDiscoverHref();
  const [fromDiscover, setFromDiscover] = useState(false);
  useEffect(() => {
    // 이 화면을 처음 그린 뒤 한 번만 읽는다(세션 저장소는 서버 렌더링에서 읽을 수 없다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFromDiscover(consumeOpenedFromDiscover());
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-28 sm:px-6 md:pt-6 lg:px-10 lg:pb-20">
      <Link
        href={discoverHref}
        onClick={(e) => {
          if (!fromDiscover || e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          router.back();
        }}
        className="mb-4 inline-flex h-10 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted hover:text-fg lg:mb-6"
      >
        <ArrowLeft className="size-4" aria-hidden />
        공고 둘러보기
      </Link>
      {a ? (
        <section aria-label="공고 상세">
          <AnnouncementDetail key={a.id} a={a} headingLevel={1} variant="page" />
        </section>
      ) : (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <FileSearch className="size-7 text-faint" aria-hidden />
          <div>
            <p className="font-semibold">공고를 찾을 수 없어요</p>
            <p className="mt-1 text-sm text-muted">마감된 지 오래되어 목록에서 내려갔거나 주소가 잘못되었을 수 있어요.</p>
          </div>
          <Link href="/discover" className={buttonClass("primary")}>
            공고 둘러보기
          </Link>
        </div>
      )}
    </div>
  );
}
