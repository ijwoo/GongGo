import type { Announcement, RevisionKind } from "@/domain/types";
import { formatDeadline, formatVenue } from "@/domain/announcement";
import { addLocalDays, seoulInstant, seoulDateOf, type LocalDate } from "@/domain/time";
import { PLACES } from "./places";

/**
 * 데모에서 사용자가 직접 발생시킬 수 있는 공고 변경.
 * 실제 서비스에서는 수집기가 원문 변경을 감지해 새 revision을 만든다.
 */
export interface DemoChange {
  id: string;
  announcementId: string;
  kind: RevisionKind;
  label: string;
  apply: (a: Announcement, anchor: LocalDate) => { next: Announcement; summary: string; before: string; after: string };
}

export const DEMO_CHANGES: DemoChange[] = [
  {
    id: "demo-deadline-extend",
    announcementId: "hk-pangyo-ai",
    kind: "deadline",
    label: "판교 생성형 AI 해커톤 마감 3일 연장",
    apply: (a, anchor) => {
      const current = a.applicationDeadline;
      const base = current.type === "datetime" ? seoulDateOf(current.at) : anchor;
      const next = { type: "datetime" as const, at: seoulInstant(addLocalDays(base, 3), "18:00") };
      return {
        next: { ...a, applicationDeadline: next },
        summary: "신청 마감일이 연장되었습니다.",
        before: formatDeadline(current),
        after: formatDeadline(next),
      };
    },
  },
  {
    id: "demo-venue-move",
    announcementId: "ev-seongsu-meetup",
    kind: "venue",
    label: "프론트엔드 성능 밋업 장소 변경",
    apply: (a) => {
      const next = { status: "confirmed" as const, ...PLACES.gangnam };
      return {
        next: { ...a, venue: next },
        summary: "행사 장소가 변경되었습니다.",
        before: formatVenue(a.venue),
        after: formatVenue(next),
      };
    },
  },
  {
    id: "demo-docs-added",
    announcementId: "su-gwanak-student",
    kind: "conditions",
    label: "대학생 창업동아리 지원 서류 추가",
    apply: (a) => {
      const docs = [...a.requiredDocuments, "지도교수 추천서"];
      return {
        next: { ...a, requiredDocuments: docs },
        summary: "준비 서류가 추가되었습니다.",
        before: a.requiredDocuments.join(", "),
        after: docs.join(", "),
      };
    },
  },
  {
    id: "demo-cancel",
    announcementId: "ed-yangjae-ai",
    kind: "cancel",
    label: "AI 엔지니어 전환 과정 취소",
    apply: (a) => ({
      next: { ...a, status: "cancelled" },
      summary: "운영 기관 사정으로 과정이 취소되었습니다.",
      before: "모집 중",
      after: "취소",
    }),
  },
];

export interface AppliedChange {
  id: string;
  appliedAt: string;
}

/** 적용된 데모 변경을 공고에 반영한다. 적용 순서대로 revision과 contentVersion이 늘어난다. */
export function applyDemoChanges(list: Announcement[], applied: AppliedChange[], anchor: LocalDate): Announcement[] {
  if (applied.length === 0) return list;
  const byId = new Map(list.map((a) => [a.id, a]));
  for (const { id, appliedAt } of applied) {
    const change = DEMO_CHANGES.find((c) => c.id === id);
    const target = change && byId.get(change.announcementId);
    if (!change || !target) continue;
    const { next, summary, before, after } = change.apply(target, anchor);
    const version = target.contentVersion + 1;
    byId.set(target.id, {
      ...next,
      contentVersion: version,
      sourceUpdatedAt: appliedAt,
      lastCheckedAt: appliedAt,
      revisions: [...target.revisions, { id: `${target.id}-${id}`, version, changedAt: appliedAt, kind: change.kind, summary, before, after }],
    });
  }
  return list.map((a) => byId.get(a.id)!);
}
