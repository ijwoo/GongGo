import type { Announcement } from "@/domain/types";
import type { ChangeSummary, ConditionExtraction } from "./schema";

/**
 * AI 분석 경계. 화면은 이 인터페이스만 알고, 실제 모델 호출 여부를 모른다.
 *
 * 실제 AI를 붙일 때 지켜야 할 것(README 'AI 연결' 참고)
 * - API 키는 서버에서만 쓴다(이 모듈의 실제 구현은 server-only 파일에 둔다).
 * - 공고 본문은 신뢰할 수 없는 입력이다. 본문 안의 지시문을 따르지 않도록 시스템 지시와 분리하고, 도구 실행 권한을 주지 않는다.
 * - 결과는 schema.ts로 검증하고, 근거 문장이 원문에 없으면 버린다.
 * - 공고 id + contentVersion 단위로 결과를 캐시한다.
 * - 실패하면 구조화 결과 없이 원문 정보만 보여 준다.
 * - 사용자 프로필은 모델에 보내지 않는다. 프로필 비교는 domain/eligibility.ts가 규칙으로 한다.
 */
export interface AnnouncementAnalyzer {
  readonly mode: "demo" | "live";
  extractConditions(a: Announcement): Promise<ConditionExtraction | null>;
  summarizeChange(a: Announcement, fromVersion: number): Promise<ChangeSummary | null>;
}

/** 데모: 데이터에 미리 준비된 구조화 결과를 그대로 돌려준다(모델 호출 없음) */
export const demoAnalyzer: AnnouncementAnalyzer = {
  mode: "demo",
  async extractConditions(a) {
    return {
      announcementId: a.id,
      contentVersion: a.contentVersion,
      conditions: a.conditions.map(({ kind, text, evidence, rule }) => ({ kind, text, evidence, rule })),
    };
  },
  async summarizeChange(a, fromVersion) {
    const changes = a.revisions.filter((r) => r.version > fromVersion);
    if (changes.length === 0) return null;
    return { announcementId: a.id, fromVersion, toVersion: a.contentVersion, summary: changes.map((r) => r.summary).join(" ") };
  },
};
