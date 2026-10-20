"use client";

import { AlertTriangle, ClipboardList, ExternalLink, History, Info, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRequireLogin } from "@/components/auth/login-gate";
import { AddToCalendarButton } from "@/components/calendar/add-to-calendar";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  applicationState,
  CATEGORY_LABEL,
  daysUntilDeadline,
  formatCost,
  formatDeadline,
  formatEventSchedule,
  formatSupport,
  formatTeamSize,
  MODE_LABEL,
} from "@/domain/announcement";
import { ELIGIBILITY_LABEL, evaluateCondition, type EligibilityResult } from "@/domain/eligibility";
import { formatSeoulDateTime } from "@/domain/time";
import type { Announcement, ApplicationStart } from "@/domain/types";
import { sourcePolicy } from "@/data/sources";
import { usePersonal, newId } from "@/hooks/use-personal";
import { useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { markSeen, upsertApplication } from "@/lib/personal-actions";
import { readPersonalState, updatePersonalState } from "@/lib/personal-store";
import { CompareButton } from "./compare-toggle";
import { OrgMark } from "./org-mark";
import { Poster } from "./poster";
import { SaveButton } from "./save-button";
import { StateBadge } from "./status";

const RESULT_TONE: Record<EligibilityResult, Tone> = {
  meets: "success",
  notMeets: "danger",
  check: "warning",
  noInfo: "neutral",
};

function formatStart(s: ApplicationStart): string {
  if (s.type === "tbd") return "미정";
  return s.type === "datetime" ? formatSeoulDateTime(s.at) : formatDeadline({ type: "date", date: s.date }).replace(" · 시각 미공지", "");
}

/** 위치 정확도. 정확한 행사 장소, 시·구 단위의 대략 위치, 장소 미정·온라인을 섞지 않는다 */
export function LocationAccuracyLabel({ a, className }: { a: Announcement; className?: string }) {
  const v = a.venue;
  const text =
    v.status === "confirmed"
      ? "정확한 행사 장소"
      : v.status === "online"
        ? "온라인 진행"
        : v.area
          ? "정확한 장소 미확인 · 시·구 단위"
          : "장소 미정";
  return <span className={cn("text-[13px] text-muted", className)}>{text}</span>;
}

interface Fact {
  label: string;
  main: ReactNode;
  sub?: ReactNode;
  urgent?: boolean;
}

/** 오른쪽 요약에 놓을 핵심 사실. 값이 없는 항목은 ‘정보 없음’을 반복하지 않고 뺀다(마감은 미확인이라도 보여 준다) */
function keyFacts(a: Announcement, now: string): Fact[] {
  const facts: Fact[] = [];
  const d = a.applicationDeadline;
  const days = daysUntilDeadline(a, now);
  const state = applicationState(a, now);
  const dday = days !== null && days >= 0 && a.status !== "cancelled" ? (days === 0 ? "오늘 마감" : `D-${days}`) : null;
  facts.push({
    label: "신청 마감",
    main:
      d.type === "datetime" || d.type === "date"
        ? formatDeadline(d)
        : d.type === "tbd"
          ? "마감 미확인"
          : formatDeadline(d),
    sub: d.type === "tbd" ? "원문에서 확인하세요" : d.type === "untilBudget" && d.note ? d.note : dday,
    urgent: state === "closingSoon",
  });
  if (state === "upcoming") facts.push({ label: "신청 시작", main: formatStart(a.applicationStart) });
  // 채용·창업 지원은 행사 개념이 없으니 일정이 없으면 행을 만들지 않는다
  if (a.event.type !== "tbd" || (a.category !== "job" && a.category !== "startup")) {
    facts.push({ label: "행사 일정", main: a.event.type === "tbd" ? "미정" : formatEventSchedule(a.event) });
  }
  const v = a.venue;
  facts.push({
    label: "장소",
    main: v.status === "confirmed" ? v.name : v.status === "online" ? `온라인${v.platform ? ` · ${v.platform}` : ""}` : v.area ? v.area.label : "장소 미정",
    sub: v.status === "online" ? null : <LocationAccuracyLabel a={a} />,
  });
  if (a.cost) facts.push({ label: "참가비", main: formatCost(a.cost) });
  if (a.supportAmount && a.supportAmount.type !== "none") facts.push({ label: "지원 규모", main: formatSupport(a.supportAmount) });
  return facts;
}

function FactList({ facts, compact }: { facts: Fact[]; compact?: boolean }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {facts.map((f) => (
        <div key={f.label} className={cn("grid grid-cols-[76px_minmax(0,1fr)] gap-3", compact ? "py-2.5" : "py-3")}>
          <dt className="pt-px text-[13px] text-muted">{f.label}</dt>
          <dd className="min-w-0 break-keep">
            <span className={cn("num block text-[15px] leading-snug font-semibold", f.urgent ? "text-danger" : "text-fg")}>{f.main}</span>
            {f.sub ? <span className={cn("num mt-0.5 block text-[13px]", f.urgent ? "font-semibold text-danger" : "text-muted")}>{f.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SourceLink({ a, className }: { a: Announcement; className?: string }) {
  return (
    <a
      href={a.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass("secondary", "md", cn("w-full", className))}
      aria-label={`원문 보기: ${a.title} (새 창에서 ${a.sourceName}로 이동)`}
    >
      원문 보기
      <ExternalLink className="size-4 text-muted" aria-hidden />
    </a>
  );
}

function Section({ title, children, id, as: H = "h2" }: { title: string; children: ReactNode; id: string; as?: "h2" | "h3" }) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-7 first:border-t-0 first:pt-0">
      <H id={id} className="mb-3 text-[19px] leading-tight font-bold tracking-[-0.01em]">
        {title}
      </H>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-2 text-[15px]">
      <dt className="text-[13px] leading-6 text-muted">{label}</dt>
      <dd className="min-w-0 break-keep">{children}</dd>
    </div>
  );
}

function useDetailState(a: Announcement) {
  const now = useNow();
  const { state, loggedIn, hydrated } = usePersonal();
  const requireLogin = useRequireLogin();
  const toast = useToast();
  const saved = state.saved.find((x) => x.announcementId === a.id);
  const unseenChange = Boolean(saved && saved.seenVersion < a.contentVersion);
  // 열었을 때 변경이 있었다면, 확인 처리 후에도 이 화면을 보는 동안은 안내를 유지한다
  const [showChanged, setShowChanged] = useState(false);
  if (unseenChange && !showChanged) setShowChanged(true);
  const application = state.applications.find((x) => x.announcementId === a.id);

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

  return { now, state, loggedIn, hydrated, requireLogin, showChanged: hydrated && showChanged, application, addApplication };
}

type DetailState = ReturnType<typeof useDetailState>;

/** 오른쪽 요약: 분야·주최 → 제목 → 접수 상태 → 핵심 사실 → 저장·캘린더·원문 → 비교·지원 준비 */
function Summary({ a, s, Heading, variant }: { a: Announcement; s: DetailState; Heading: "h1" | "h2" | "h3"; variant: "panel" | "page" }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <OrgMark org={a.organizer} />
        <p className="min-w-0 text-[13px] leading-snug text-muted">
          <span className="font-semibold text-accent-text">{CATEGORY_LABEL[a.category]}</span>
          <span aria-hidden> · </span>
          <span className="text-fg-2">{a.organizer.name}</span>
        </p>
      </div>
      <Heading
        id={`detail-title-${a.id}`}
        className={cn(
          "mt-3 leading-[1.3] font-bold tracking-[-0.02em] break-keep",
          variant === "page" ? "text-[24px] lg:text-[28px]" : "text-[21px]",
        )}
      >
        {a.title}
      </Heading>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StateBadge a={a} now={s.now} />
        <Badge>{MODE_LABEL[a.participationMode]}</Badge>
        {a.revisions.length > 0 ? <Badge tone="warning">공고 수정 {a.revisions.length}회</Badge> : null}
      </div>

      {a.status === "cancelled" ? (
        <div role="alert" className="mt-4 flex gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <b>{a.category === "job" ? "마감된 채용 공고예요." : "취소된 공고예요."}</b> {a.revisions.findLast((r) => r.kind === "cancel")?.summary}
          </p>
        </div>
      ) : null}
      {s.showChanged ? (
        <div className="mt-4 flex gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
          <History className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>관심 저장한 뒤 바뀐 내용이 있어요. 변경 이력을 확인하세요.</p>
        </div>
      ) : null}

      <div className="mt-5">
        <FactList facts={keyFacts(a, s.now)} compact={variant === "panel"} />
      </div>

      {/* 상세 페이지의 좁은 화면에서는 같은 동작을 하단 막대가 맡는다 */}
      <div className={cn("mt-5 space-y-2", variant === "page" && "hidden lg:block")}>
        <div className="grid grid-cols-2 gap-2">
          <SaveButton a={a} variant="full" className="w-full" />
          <AddToCalendarButton a={a} className="w-full" />
        </div>
        <SourceLink a={a} />
        <p className="text-center text-xs text-muted">신청은 {a.sourceName}에서 진행해요. 새 창으로 열려요.</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
        <CompareButton a={a} />
        {s.application ? (
          <Link href="/applications" className={buttonClass("ghost", "sm")}>
            <ClipboardList className="size-4 text-accent" aria-hidden />
            지원 현황 보기
          </Link>
        ) : (
          <Button variant="ghost" size="sm" onClick={s.addApplication}>
            <ClipboardList className="size-4 text-muted" aria-hidden />
            지원 준비에 추가
          </Button>
        )}
      </div>
    </div>
  );
}

/** 본문: 확인할 사항 → 참여 조건 → 준비 서류 → 장소 → 변경 이력 → 출처 */
function Body({ a, s, sectionHeading }: { a: Announcement; s: DetailState; sectionHeading: "h2" | "h3" }) {
  const policy = sourcePolicy(a.sourceId);
  const v = a.venue;
  const restricted = a.eligibilityRegions.length > 0;
  const hasTerms = a.conditions.length > 0 || a.teamSize !== null || restricted;
  const sid = (k: string) => `s-${k}-${a.id}`;
  return (
    <div>
      {a.checkPoints.length ? (
        <Section title="지원 전 확인할 사항" id={sid("check")} as={sectionHeading}>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed break-keep">
            {a.checkPoints.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="참여 조건" id={sid("cond")} as={sectionHeading}>
        {hasTerms ? (
          <>
            {a.teamSize || restricted ? (
              <dl className="mb-3">
                {a.teamSize ? <Row label="팀 구성">{formatTeamSize(a.teamSize)}</Row> : null}
                {restricted ? <Row label="지원 지역">{a.eligibilityRegions.join("·")}</Row> : null}
              </dl>
            ) : null}
            {a.conditions.length ? (
              <ul className="space-y-2">
                {a.conditions.map((c) => {
                  const ev = evaluateCondition(c, s.loggedIn ? s.state.profile : null);
                  return (
                    <li key={c.id} className="rounded-md bg-subtle px-3.5 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-xs font-semibold text-muted">{c.kind === "required" ? "필수" : "우대"}</span>
                        <p className="min-w-0 flex-1 text-[15px] font-medium break-keep">{c.text}</p>
                        {s.hydrated && s.loggedIn ? <Badge tone={RESULT_TONE[ev.result]}>{ELIGIBILITY_LABEL[ev.result]}</Badge> : null}
                      </div>
                      {s.hydrated && s.loggedIn ? <p className="mt-1 pl-7 text-[13px] text-muted">{ev.reason}</p> : null}
                      <details className="mt-1.5 pl-7 text-[13px]">
                        <summary className="cursor-pointer text-muted hover:text-fg">근거 문장 · {c.origin === "source" ? "원문 그대로" : "AI 구조화"}</summary>
                        <blockquote className="mt-1 border-l-2 border-line-strong pl-2 text-fg">“{c.evidence}”</blockquote>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {s.hydrated && !s.loggedIn && a.conditions.length ? (
              <p className="mt-3 flex items-start gap-1.5 text-[13px] text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  로그인하면 내 프로필과 조건을 비교해 드려요.{" "}
                  <button
                    type="button"
                    className="font-semibold text-accent-text hover:underline"
                    onClick={() => s.requireLogin({ reason: "프로필과 조건을 비교하려면 로그인이 필요해요.", onAuthorized: () => {} })}
                  >
                    로그인하고 비교하기
                  </button>
                </span>
              </p>
            ) : null}
            {a.conditions.length ? <p className="mt-3 text-xs text-muted">비교 결과는 참고용이에요. 단정할 수 없으면 ‘확인 필요’로 표시해요. 최종 자격은 원문으로 확인하세요.</p> : null}
          </>
        ) : (
          // 조건이 ‘없다’고 단정하지 않는다. 출처가 조건을 따로 주지 않는 공고가 많다
          <p className="text-[15px] text-muted">아직 정리된 참여 조건이 없어요. 자격 요건은 원문에서 확인하세요.</p>
        )}
      </Section>

      <Section title="준비 서류" id={sid("docs")} as={sectionHeading}>
        {a.requiredDocuments.length ? (
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] break-keep">
            {a.requiredDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted">아직 정리된 준비 서류가 없어요. 원문에서 확인하세요.</p>
        )}
      </Section>

      <Section title="장소" id={sid("place")} as={sectionHeading}>
        {v.status === "confirmed" ? (
          <>
            <p className="text-[15px] font-semibold">{v.name}</p>
            <p className="mt-0.5 text-[15px] text-fg-2">{v.address}</p>
          </>
        ) : v.status === "online" ? (
          <p className="text-[15px]">온라인으로 진행해요{v.platform ? ` (${v.platform})` : ""}.</p>
        ) : v.area ? (
          <>
            <p className="text-[15px] font-semibold">{v.area.label}</p>
            <p className="mt-0.5 text-[15px] text-fg-2">정확한 장소는 아직 확인하지 못했어요{v.note ? ` · ${v.note}` : ""}.</p>
          </>
        ) : (
          <p className="text-[15px] text-fg-2">장소가 아직 정해지지 않았어요{v.note ? ` · ${v.note}` : ""}.</p>
        )}
        {v.status === "confirmed" || (v.status === "tbd" && v.area?.coordinates) ? (
          <Link
            href={`/discover?view=map&id=${encodeURIComponent(a.id)}`}
            className="mt-3 inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline"
          >
            <MapPin className="size-4" aria-hidden />
            {v.status === "confirmed" ? "지도에서 위치 보기" : "지도에서 대략 위치 보기"}
          </Link>
        ) : null}
        {a.organizer.address ? (
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer text-muted hover:text-fg">주최기관 주소</summary>
            <p className="mt-1 text-fg-2">
              {a.organizer.address} <span className="text-muted">(행사 장소와 다를 수 있어요)</span>
            </p>
          </details>
        ) : null}
      </Section>

      <Section title="변경 이력" id={sid("rev")} as={sectionHeading}>
        {a.revisions.length === 0 ? (
          <p className="text-[15px] text-muted">처음 게시된 뒤 바뀐 내용이 없어요.</p>
        ) : (
          <ol className="space-y-4">
            {[...a.revisions].reverse().map((r) => (
              <li key={r.id} className="text-[15px]">
                <p className="num text-[13px] text-muted">
                  {formatSeoulDateTime(r.changedAt)} · 버전 {r.version}
                </p>
                <p className="mt-0.5 font-semibold">{r.summary}</p>
                <p className="mt-0.5 text-sm">
                  <span className="text-muted line-through">{r.before}</span>
                  <span className="mx-1 text-muted" aria-hidden>
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

      <footer className="border-t border-line pt-5 text-[13px] text-muted">
        <p className="num">
          출처 {a.sourceName} · 마지막 확인 {formatSeoulDateTime(a.lastCheckedAt)}
        </p>
        {policy ? <p className="mt-1">{policy.attribution}</p> : null}
      </footer>
    </div>
  );
}

/**
 * 공고 상세.
 * - page: 독립 상세 페이지. 넓은 화면은 왼쪽 본문(이미지·조건·서류·장소·이력)과 오른쪽 고정 요약(사실·저장·캘린더·원문) 2열,
 *   좁은 화면은 제목·핵심 일정 → 이미지·본문 순 한 열에 하단 액션 막대.
 * - panel: 지도 옆 패널·시트. 요약 다음에 본문을 한 열로.
 */
export function AnnouncementDetail({
  a,
  headingLevel = 2,
  variant = "panel",
}: {
  a: Announcement;
  headingLevel?: 1 | 2 | 3;
  variant?: "panel" | "page";
}) {
  const s = useDetailState(a);
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  const sectionHeading = headingLevel === 3 ? "h3" : "h2";

  if (variant === "panel") {
    return (
      <article aria-labelledby={`detail-title-${a.id}`} className="bg-[inherit] px-5 pt-5 pb-8">
        <div className="pr-8">
          <Summary a={a} s={s} Heading={Heading} variant="panel" />
        </div>
        <div className="mt-8">
          <Body a={a} s={s} sectionHeading={headingLevel === 2 ? "h3" : sectionHeading} />
        </div>
      </article>
    );
  }

  return (
    <article
      aria-labelledby={`detail-title-${a.id}`}
      className="grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-x-12"
    >
      {/* 좁은 화면에서는 요약이 먼저 온다 */}
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        <div className="lg:sticky lg:top-[96px] lg:max-h-[calc(100dvh-112px)] lg:overflow-y-auto lg:overscroll-contain lg:pb-2">
          <Summary a={a} s={s} Heading={Heading} variant="page" />
        </div>
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <Poster a={a} variant="detail" className="mb-9" />
        <Body a={a} s={s} sectionHeading={sectionHeading} />
      </div>

      {/* 모바일·태블릿 하단 액션. 페이지 아래 여백(pb)으로 본문을 가리지 않는다 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-[640px] grid-cols-[auto_1fr_1fr] gap-2">
          <SaveButton a={a} variant="icon" className="size-10 rounded-md border border-line-strong" />
          <AddToCalendarButton a={a} className="w-full" />
          <a
            href={a.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", "md", "w-full")}
            aria-label={`원문 보기: ${a.title} (새 창)`}
          >
            원문 보기
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}
