"use client";

import Link from "next/link";
import { useState } from "react";
import { venueShort } from "@/domain/announcement";
import { JOB_LEVEL_LABEL, JOB_ROLE_LABEL, jobLevelsOf, jobRolesOf } from "@/domain/job";
import type { Announcement } from "@/domain/types";
import { announcementHref, markOpenedFromDiscover } from "@/lib/announcement-href";
import { OrgMark } from "./org-mark";
import { SaveButton } from "./save-button";
import { DeadlineCell } from "./status";

const PAGE = 40;

/** 회사 표시. 채용 공고 이미지는 대부분 회사 로고라 작은 정사각형에 잘리지 않게 넣는다 */
function CompanyMark({ a }: { a: Announcement }) {
  const [failed, setFailed] = useState(false);
  if (!a.image || failed) return <OrgMark org={a.organizer} />;
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={a.image.url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="max-h-full max-w-full object-contain"
      />
    </span>
  );
}

/**
 * 채용 공고 목록. 갤러리에서는 같은 회사 로고가 수십 번 반복되므로
 * 회사 · 제목 · 직무·경력(제목에서 읽은 값) · 위치 · 마감을 한 줄씩 훑어볼 수 있게 보여 준다.
 */
export function JobList({ items, now, label }: { items: Announcement[]; now: string; label: string }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);
  return (
    <>
      <ul aria-label={label} className="divide-y divide-line border-y border-line">
        {shown.map((a) => {
          const roles = jobRolesOf(a.title).filter((r) => r !== "other");
          const levels = jobLevelsOf(a.title);
          const meta = [...roles.map((r) => JOB_ROLE_LABEL[r]), ...levels.map((l) => JOB_LEVEL_LABEL[l]), venueShort(a)];
          return (
            <li
              key={a.id}
              className="group relative grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-4 py-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-[var(--focus)] sm:grid-cols-[48px_minmax(0,1fr)_120px_auto]"
            >
              <CompanyMark a={a} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-accent-text">{a.organizer.name}</p>
                <h3 className="mt-0.5 line-clamp-2 text-base leading-snug font-semibold break-keep">
                  <Link
                    href={announcementHref(a.id)}
                    onClick={markOpenedFromDiscover}
                    className="group-hover:text-accent-text focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
                  >
                    {a.title}
                  </Link>
                </h3>
                <p className="mt-1 truncate text-[13px] text-muted">{meta.join(" · ")}</p>
                <div className="mt-1 sm:hidden">
                  <DeadlineCell a={a} now={now} />
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <DeadlineCell a={a} now={now} />
              </div>
              <SaveButton a={a} className="relative z-[1]" />
            </li>
          );
        })}
      </ul>
      {items.length > limit ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className="inline-flex h-11 items-center gap-1.5 rounded-md border border-line-strong bg-panel px-5 text-[15px] font-semibold hover:bg-subtle"
          >
            더 보기 <span className="num text-muted">{items.length - limit}건 남음</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
