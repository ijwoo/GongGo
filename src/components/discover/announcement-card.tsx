"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { CATEGORY_LABEL, cancelledLabel, venueShort } from "@/domain/announcement";
import { cardDeadline, cardEventLabel } from "@/domain/card";
import type { Announcement } from "@/domain/types";
import { announcementHref, markOpenedFromDiscover } from "@/lib/announcement-href";
import { cn } from "@/lib/cn";
import { Poster } from "./poster";
import { SaveButton } from "./save-button";

/**
 * 갤러리 카드. 표지 → 분야·지역 → 제목 → 주최 → 행사일·마감.
 * 카드 전체가 상세 링크(제목 링크를 카드 크기로 늘림)이고, 저장 버튼은 그 위에 따로 놓여 링크 안에 중첩되지 않는다.
 */
export function AnnouncementCard({ a, now, headingLevel = 3 }: { a: Announcement; now: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const event = cardEventLabel(a);
  const deadline = cardDeadline(a, now);
  const place = venueShort(a);
  return (
    <article className="group relative min-w-0 rounded-[12px] outline-offset-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-[var(--focus)]">
      <div className="relative">
        <Poster a={a} className="transition-[filter] duration-200 group-hover:brightness-[0.97]" />
        {a.status === "cancelled" ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[#202622]/85 px-2 py-1 text-xs font-semibold text-white">{cancelledLabel(a)}</span>
        ) : null}
      </div>
      <p className="mt-3 truncate text-[13px] text-muted">
        <span className="font-semibold text-accent-text">{CATEGORY_LABEL[a.category]}</span>
        <span aria-hidden> · </span>
        {place}
      </p>
      <Heading className="mt-1 line-clamp-2 min-h-[2.7em] text-[17px] leading-[1.35] font-semibold break-keep text-fg">
        <Link
          href={announcementHref(a.id)}
          onClick={markOpenedFromDiscover}
          className="transition-colors group-hover:text-accent-text focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
        >
          {a.title}
        </Link>
      </Heading>
      <p className="mt-1 truncate text-sm text-muted">{a.organizer.name}</p>
      <p className="num mt-2.5 flex items-center gap-2 text-sm text-fg-2">
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        {event ? (
          <>
            <span className="truncate">{event}</span>
            <span className="h-3 w-px shrink-0 bg-line-strong" aria-hidden />
          </>
        ) : null}
        <span className={cn("shrink-0", deadline.urgent && "font-semibold text-danger")}>{deadline.label}</span>
      </p>
      {/* 링크(카드 전체)보다 위에 놓는다 */}
      <SaveButton a={a} variant="overlay" className="absolute top-2.5 right-2.5 z-[1]" />
    </article>
  );
}
