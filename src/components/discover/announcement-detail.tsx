"use client";

import { AlertTriangle, ClipboardList, ExternalLink, History, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRequireLogin } from "@/components/auth/login-gate";
import { AddToCalendarButton } from "@/components/calendar/add-to-calendar";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  CATEGORY_LABEL,
  daysUntilDeadline,
  formatCost,
  formatKrw,
  formatDeadline,
  formatEventSchedule,
  formatSupport,
  formatTeamSize,
  MODE_LABEL,
  venueShort,
} from "@/domain/announcement";
import { ELIGIBILITY_LABEL, evaluateCondition, type EligibilityResult } from "@/domain/eligibility";
import { formatLocalDateShort, formatSeoulDateTime, formatSeoulTime, seoulDateOf } from "@/domain/time";
import type { Announcement, ApplicationStart } from "@/domain/types";
import { sourcePolicy } from "@/data/sources";
import { usePersonal, newId } from "@/hooks/use-personal";
import { useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { markSeen, upsertApplication } from "@/lib/personal-actions";
import { readPersonalState, updatePersonalState } from "@/lib/personal-store";
import { CompareButton } from "./compare-toggle";
import { OrgMark } from "./org-mark";
import { SaveButton } from "./save-button";
import { StateBadge } from "./status";

const RESULT_TONE: Record<EligibilityResult, Tone> = { meets: "success", notMeets: "danger", check: "warning", noInfo: "neutral" };

function formatStart(s: ApplicationStart): string {
  if (s.type === "tbd") return "미정";
  return s.type === "datetime" ? formatSeoulDateTime(s.at) : formatDeadline({ type: "date", date: s.date }).replace(" · 시각 미공지", "");
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-keep text-fg-2">{children}</dd>
    </div>
  );
}

function Section({ title, icon, children, id }: { title: string; icon?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-12 border-b border-line px-5 py-5 last:border-b-0">
      <h3 id={id ? `${id}-title` : undefined} className="mb-3 flex items-center gap-1.5 text-[15px] font-bold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Missing() {
  return <span className="text-faint">정보 없음</span>;
}

/** 결정에 바로 필요한 네 가지를 위에 크게 */
function KeyFacts({ a, now }: { a: Announcement; now: string }) {
  const d = a.applicationDeadline;
  const days = daysUntilDeadline(a, now);
  const deadlineMain =
    d.type === "datetime"
      ? formatLocalDateShort(seoulDateOf(d.at))
      : d.type === "date"
        ? formatLocalDateShort(d.date)
        : d.type === "rolling"
          ? "상시 모집"
          : d.type === "untilBudget"
            ? "예산 소진 시"
            : "미정";
  const deadlineSub =
    d.type === "datetime"
      ? `${formatSeoulTime(d.at)}${days !== null && days >= 0 ? ` · ${days === 0 ? "오늘 마감" : `D-${days}`}` : ""}`
      : d.type === "date"
        ? `시각 미공지${days !== null && days >= 0 ? ` · ${days === 0 ? "오늘 마감" : `D-${days}`}` : ""}`
        : "고정 마감일 없음";
  const e = a.event;
  const eventMain =
    e.type === "dates"
      ? e.start === e.end
        ? formatLocalDateShort(e.start)
        : `${formatLocalDateShort(e.start)}~`
      : e.type === "datetime"
        ? formatLocalDateShort(seoulDateOf(e.start))
        : e.type === "ongoing"
          ? "상시 진행"
          : "미정";
  const eventSub =
    e.type === "dates"
      ? e.start === e.end
        ? "종일"
        : `${formatLocalDateShort(e.end)}까지`
      : e.type === "datetime"
        ? `${formatSeoulTime(e.start)}~${formatSeoulTime(e.end)}`
        : "일정 공지 전";
  const facts = [
    { label: "신청 마감", main: deadlineMain, sub: deadlineSub, tone: days !== null && days >= 0 && days <= 3 && a.status !== "cancelled" },
    { label: "행사 일정", main: eventMain, sub: eventSub },
    { label: "장소", main: venueShort(a), sub: a.venue.status === "confirmed" ? a.venue.name : MODE_LABEL[a.participationMode] },
    {
      label: a.supportAmount && a.supportAmount.type !== "none" ? "지원 규모" : "참가비",
      main:
        a.supportAmount && a.supportAmount.type === "amount"
          ? `최대 ${formatKrw(a.supportAmount.maxKrw)}`
          : a.supportAmount && a.supportAmount.type === "text"
            ? "별도 지원"
            : a.cost
              ? formatCost(a.cost)
              : "정보 없음",
      sub: a.supportAmount && a.supportAmount.type === "text" ? a.supportAmount.text : a.cost ? `참가비 ${formatCost(a.cost)}` : "원문 확인",
    },
  ];
  return (
    <dl className="mx-5 mb-4 grid grid-cols-2 overflow-hidden rounded-lg border border-line">
      {facts.map((f, i) => (
        <div key={f.label} className={cn("min-w-0 px-3.5 py-3", i % 2 === 1 && "border-l border-line", i > 1 && "border-t border-line")}>
          <dt className="text-xs text-muted">{f.label}</dt>
          <dd className={cn("num mt-1 truncate text-base font-bold", f.tone ? "text-danger" : "text-fg")}>{f.main}</dd>
          <dd className="num truncate text-xs text-muted" title={f.sub}>
            {f.sub}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AnnouncementDetail({ a, headingLevel = 2 }: { a: Announcement; headingLevel?: 2 | 3 }) {
  const now = useNow();
  const { state, loggedIn, hydrated } = usePersonal();
  const requireLogin = useRequireLogin();
  const toast = useToast();
  const policy = sourcePolicy(a.sourceId);
  const saved = state.saved.find((x) => x.announcementId === a.id);
  const unseenChange = Boolean(saved && saved.seenVersion < a.contentVersion);
  // 열었을 때 변경이 있었다면, 확인 처리 후에도 이 패널을 보는 동안은 안내를 유지한다
  const [showChanged, setShowChanged] = useState(false);
  if (unseenChange && !showChanged) setShowChanged(true);
  const application = state.applications.find((x) => x.announcementId === a.id);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  // 변경 내용을 화면에 보여 준 다음 확인 처리한다(배너는 이번에 열었을 때까지 유지)
  useEffect(() => {
    if (!loggedIn) return;
    const id = window.setTimeout(() => updatePersonalState((s) => markSeen(s, a)), 1500);
    return () => window.clearTimeout(id);
  }, [a, loggedIn]);

  const addApplication = () =>
    requireLogin({
      reason: "지원 준비 목록은 계정에 저장돼요. 로그인하면 메모와 준비 체크리스트를 관리할 수 있어요.",
      onAuthorized: () => {
        const exists = readPersonalState().applications.some((x) => x.announcementId === a.id);
        if (!exists) updatePersonalState((s) => upsertApplication(s, a, {}, now, newId));
        toast({ message: exists ? "이미 지원 현황에 있어요." : "지원 현황에 추가했어요. 준비 서류를 체크리스트로 만들었어요." });
      },
    });

  const sections = [
    { id: `s-schedule-${a.id}`, label: "일정·장소" },
    { id: `s-cond-${a.id}`, label: "자격 조건" },
    { id: `s-docs-${a.id}`, label: "서류" },
    { id: `s-rev-${a.id}`, label: "변경 이력" },
  ];

  return (
    <article aria-labelledby={`detail-title-${a.id}`} className="bg-[inherit] pb-8">
      <header className="px-5 pt-5 pr-12 pb-4">
        <div className="mb-3 flex items-center gap-2.5">
          <OrgMark org={a.organizer} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg-2">{a.organizer.name}</p>
            <p className="text-xs text-muted">
              {CATEGORY_LABEL[a.category]} · {MODE_LABEL[a.participationMode]}
            </p>
          </div>
        </div>
        <Heading id={`detail-title-${a.id}`} className="text-xl leading-snug font-bold tracking-tight break-keep">
          {a.title}
        </Heading>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <StateBadge a={a} now={now} />
          {a.revisions.length > 0 ? <Badge tone="warning">공고 수정 {a.revisions.length}회</Badge> : <Badge>수정 없음</Badge>}
          <span className="num ml-auto text-xs text-faint">확인 {formatSeoulDateTime(a.lastCheckedAt)}</span>
        </div>
      </header>

      {a.status === "cancelled" ? (
        <div role="alert" className="mx-5 mb-4 flex gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <b>취소된 공고예요.</b> {a.revisions.findLast((r) => r.kind === "cancel")?.summary}
          </p>
        </div>
      ) : null}
      {hydrated && showChanged ? (
        <div className="mx-5 mb-4 flex gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
          <History className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>관심 저장한 뒤 바뀐 내용이 있어요. 아래 변경 이력을 확인하세요.</p>
        </div>
      ) : null}

      <KeyFacts a={a} now={now} />

      <div className="space-y-2 px-5 pb-5">
        <div className="grid grid-cols-2 gap-2">
          <SaveButton a={a} variant="full" className="w-full" />
          <AddToCalendarButton a={a} className="w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <CompareButton a={a} />
          {application ? (
            <Link href="/applications" className={buttonClass("ghost", "sm")}>
              <ClipboardList className="size-4 text-accent" aria-hidden />
              지원 현황 보기
            </Link>
          ) : (
            <Button variant="ghost" size="sm" onClick={addApplication}>
              <ClipboardList className="size-4 text-muted" aria-hidden />
              지원 준비에 추가
            </Button>
          )}
          <a
            href={a.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("ghost", "sm", "ml-auto text-accent-text")}
            aria-label={`원문 보기: ${a.title} (새 창에서 열림)`}
          >
            원문 보기
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>

      <nav aria-label="상세 항목" className="sticky top-0 z-[2] flex gap-1 overflow-x-auto border-y border-line bg-[inherit] px-4 py-1.5 [scrollbar-width:none]">
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => document.getElementById(sec.id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
            className="h-8 rounded-md px-2.5 text-[13px] font-semibold text-muted hover:bg-hover hover:text-fg"
          >
            {sec.label}
          </button>
        ))}
      </nav>

      <Section title="일정·장소" id={`s-schedule-${a.id}`}>
        <dl className="divide-y divide-line">
          <Row label="신청 시작">{formatStart(a.applicationStart)}</Row>
          <Row label="신청 마감">
            <span className="num">{formatDeadline(a.applicationDeadline)}</span>
            {a.applicationDeadline.type === "untilBudget" && a.applicationDeadline.note ? (
              <p className="text-xs text-muted">{a.applicationDeadline.note}</p>
            ) : null}
          </Row>
          <Row label="행사 일정">
            <span className="num">{formatEventSchedule(a.event)}</span>
          </Row>
          <Row label="행사 장소">
            {a.venue.status === "confirmed" ? (
              <>
                {a.venue.name}
                <p className="text-xs text-muted">{a.venue.address}</p>
              </>
            ) : a.venue.status === "online" ? (
              `온라인${a.venue.platform ? ` (${a.venue.platform})` : ""}`
            ) : (
              <>
                장소 미정{a.venue.note ? ` · ${a.venue.note}` : ""}
                <p className="text-xs text-muted">장소가 정해지지 않아 지도에 표시하지 않아요.</p>
              </>
            )}
          </Row>
          <Row label="지원 지역">{a.eligibilityRegions.length ? `${a.eligibilityRegions.join("·")} (지원 자격)` : "제한 없음"}</Row>
          <Row label="기관 주소">{a.organizer.address ?? <Missing />}</Row>
        </dl>
      </Section>

      <Section title="참가 조건·지원 내용" id={`s-terms-${a.id}`}>
        <dl className="divide-y divide-line">
          <Row label="참가비">{a.cost ? formatCost(a.cost) : <Missing />}</Row>
          <Row label="팀 규모">{a.teamSize ? formatTeamSize(a.teamSize) : <Missing />}</Row>
          <Row label="지원 규모">{a.supportAmount ? formatSupport(a.supportAmount) : <Missing />}</Row>
        </dl>
      </Section>

      <Section title="자격 조건" id={`s-cond-${a.id}`}>
        {hydrated && !loggedIn ? (
          <p className="mb-3 flex items-start gap-1.5 text-[13px] text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              로그인하면 내 프로필과 조건을 비교해 드려요.{" "}
              <button
                type="button"
                className="font-semibold text-accent-text hover:underline"
                onClick={() => requireLogin({ reason: "프로필과 조건을 비교하려면 로그인이 필요해요.", onAuthorized: () => {} })}
              >
                로그인하고 비교하기
              </button>
            </span>
          </p>
        ) : null}
        {a.conditions.length === 0 ? (
          <p className="text-[13px] text-muted">원문에 별도 자격 조건이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {a.conditions.map((c) => {
              const ev = evaluateCondition(c, loggedIn ? state.profile : null);
              return (
                <li key={c.id} className="rounded-md border border-line px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-px shrink-0 text-xs font-semibold text-muted">{c.kind === "required" ? "필수" : "우대"}</span>
                    <p className="min-w-0 flex-1 text-[13px] font-medium break-keep">{c.text}</p>
                    {hydrated && loggedIn ? <Badge tone={RESULT_TONE[ev.result]}>{ELIGIBILITY_LABEL[ev.result]}</Badge> : null}
                  </div>
                  {hydrated && loggedIn ? <p className="mt-1 pl-7 text-xs text-muted">{ev.reason}</p> : null}
                  <details className="mt-1.5 pl-7 text-xs">
                    <summary className="cursor-pointer text-muted hover:text-fg">
                      근거 문장 · {c.origin === "source" ? "원문 그대로" : "AI 구조화(데모 데이터)"}
                    </summary>
                    <blockquote className="mt-1 border-l-2 border-line-strong pl-2 text-fg">“{c.evidence}”</blockquote>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">
          비교 결과는 프로필 구간과 원문을 맞춰 본 참고 정보예요. 단정할 수 없으면 ‘확인 필요’로 표시하며, 최종 자격은 원문으로 확인하세요.
        </p>
      </Section>

      <Section title="준비 서류" id={`s-docs-${a.id}`}>
        {a.requiredDocuments.length ? (
          <ul className="list-disc space-y-1 pl-5 text-[13px]">
            {a.requiredDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">원문에 안내된 서류가 없어요.</p>
        )}
        {a.checkPoints.length ? (
          <>
            <h4 className="mt-4 mb-1 text-[13px] font-semibold">확인할 사항</h4>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted">
              {a.checkPoints.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </>
        ) : null}
      </Section>

      <Section title="변경 이력" icon={<History className="size-4 text-muted" aria-hidden />} id={`s-rev-${a.id}`}>
        {a.revisions.length === 0 ? (
          <p className="text-[13px] text-muted">처음 게시된 뒤 바뀐 내용이 없어요.</p>
        ) : (
          <ol className="space-y-3">
            {[...a.revisions].reverse().map((r) => (
              <li key={r.id} className="text-[13px]">
                <p className="num text-xs text-muted">
                  {formatSeoulDateTime(r.changedAt)} · 버전 {r.version}
                </p>
                <p className="font-medium">{r.summary}</p>
                <p className="mt-0.5 text-xs">
                  <span className="text-muted line-through">{r.before}</span>
                  <span className="mx-1 text-faint" aria-hidden>
                    →
                  </span>
                  <span className="sr-only">에서 </span>
                  <span className="font-semibold">{r.after}</span>
                  <span className="sr-only">(으)로 변경</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {policy ? <p className="px-4 pt-2 text-xs text-faint">{policy.attribution}</p> : null}
    </article>
  );
}
