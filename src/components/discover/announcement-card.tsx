"use client";

import Link from "next/link";
import { CATEGORY_LABEL, cancelledLabel, venueShort } from "@/domain/announcement";
import { cardDeadline, cardEventLabel } from "@/domain/card";
import type { Announcement } from "@/domain/types";
import { announcementHref, markOpenedFromDiscover } from "@/lib/announcement-href";
import { cn } from "@/lib/cn";
import { Poster } from "./poster";
import { SaveButton } from "./save-button";

/**
 * 갤러리 카드. 표지 → 분야·지역 → 제목 → 주최 → 신청 마감·행사일.
 * 제목·주최·날짜를 한 묶음으로 붙여 두고, 같은 줄 카드끼리는 날짜 줄만 아래에 맞춘다(제목 칸 높이를 고정하지 않음).
 * 카드 전체가 상세 링크(제목 링크를 카드 크기로 늘림)이고, 저장 버튼은 그 위에 따로 놓여 링크 안에 중첩되지 않는다.
 */
export function AnnouncementCard({ a, now, headingLevel = 3 }: { a: Announcement; now: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const event = cardEventLabel(a);
  const deadline = cardDeadline(a, now);
  const place = venueShort(a);
  return (
    <article className="group relative flex h-full min-w-0 flex-col rounded-[12px] outline-offset-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-[var(--focus)]">
      <div className="relative">
        <Poster a={a} className="transition-[filter] duration-200 group-hover:brightness-[0.97]" />
        {a.status === "cancelled" ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[#202622]/85 px-2 py-1 text-xs font-semibold text-white">{cancelledLabel(a)}</span>
        ) : null}
      </div>
      <p className="mt-3.5 truncate text-[13px] leading-5 text-muted">
        <span className="font-semibold text-accent-text">{CATEGORY_LABEL[a.category]}</span>
        <span aria-hidden> · </span>
        {place}
      </p>
      <Heading className="mt-1 line-clamp-2 text-[17px] leading-[1.38] font-semibold tracking-[-0.01em] break-keep text-fg">
        <Link
          href={announcementHref(a.id)}
          onClick={markOpenedFromDiscover}
          className="transition-colors group-hover:text-accent-text focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
        >
          {a.title}
        </Link>
      </Heading>
      <p className="mt-1 truncate text-sm text-fg-2">{a.organizer.name}</p>
      {/* 같은 줄의 다른 카드 제목이 두 줄이면 날짜 줄이 그만큼 내려가 기준선이 맞는다 */}
      <p className="num mt-auto flex items-center gap-2 pt-2 text-[13px] text-muted">
        <span className={cn("shrink-0", deadline.urgent ? "font-semibold text-danger" : "text-fg-2")}>{deadline.label}</span>
        {event ? (
          <>
            <span className="h-3 w-px shrink-0 bg-line-strong" aria-hidden />
            <span className="truncate">{event}</span>
          </>
        ) : null}
      </p>
      {/* 링크(카드 전체)보다 위에 놓는다 */}
      <SaveButton a={a} variant="overlay" className="absolute top-2.5 right-2.5 z-[1]" />
    </article>
  );
}
