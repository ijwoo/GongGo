import type { CareerBucket, ConditionRule, EligibilityCondition, UserProfile } from "./types";

export type EligibilityResult = "meets" | "notMeets" | "check" | "noInfo";

export const ELIGIBILITY_LABEL: Record<EligibilityResult, string> = {
  meets: "해당",
  notMeets: "미해당",
  check: "확인 필요",
  noInfo: "입력 정보 없음",
};

export interface EligibilityEvaluation {
  result: EligibilityResult;
  /** 판단 이유. 화면에 그대로 보여 준다 */
  reason: string;
}

/** 경력 구간을 [최소, 최대] 연차로. 6+는 상한 없음 */
const CAREER_RANGE: Record<CareerBucket, [number, number]> = {
  student: [0, 0],
  "0-2": [0, 2],
  "3-5": [3, 5],
  "6+": [6, Number.POSITIVE_INFINITY],
};

const CAREER_LABEL: Record<CareerBucket, string> = {
  student: "학생",
  "0-2": "경력 0~2년",
  "3-5": "경력 3~5년",
  "6+": "경력 6년 이상",
};

/**
 * 프로필과 조건을 비교한다.
 * 규칙으로 옮길 수 없는 조건, 구간이 걸쳐 있어 단정할 수 없는 경우는 '확인 필요'로 둔다.
 * 점수나 확률은 만들지 않는다.
 */
export function evaluateCondition(condition: EligibilityCondition, profile: UserProfile | null): EligibilityEvaluation {
  const rule = condition.rule;
  if (!rule) return { result: "check", reason: "자동으로 비교할 수 없는 조건이에요. 원문을 확인하세요." };
  if (!profile) return { result: "noInfo", reason: "프로필을 입력하면 비교할 수 있어요." };
  return evaluateRule(rule, profile);
}

function evaluateRule(rule: ConditionRule, p: UserProfile): EligibilityEvaluation {
  switch (rule.type) {
    case "region": {
      if (!p.region) return { result: "noInfo", reason: "프로필에 활동 지역이 없어요." };
      return rule.regions.includes(p.region)
        ? { result: "meets", reason: `활동 지역(${p.region})이 조건에 포함돼요.` }
        : { result: "notMeets", reason: `조건 지역은 ${rule.regions.join("·")}이고, 프로필 지역은 ${p.region}이에요.` };
    }
    case "teamSize": {
      if (!p.teamSize) return { result: "noInfo", reason: "프로필에 팀 규모가 없어요." };
      const okMin = rule.min === undefined || p.teamSize >= rule.min;
      const okMax = rule.max === undefined || p.teamSize <= rule.max;
      return okMin && okMax
        ? { result: "meets", reason: `팀 규모 ${p.teamSize}명이 조건 범위 안이에요.` }
        : { result: "notMeets", reason: `팀 규모 ${p.teamSize}명이 조건 범위를 벗어나요.` };
    }
    case "careerMaxYears":
    case "careerMinYears": {
      if (!p.career) return { result: "noInfo", reason: "프로필에 경력 구간이 없어요." };
      const [lo, hi] = CAREER_RANGE[p.career];
      const label = CAREER_LABEL[p.career];
      if (rule.type === "careerMaxYears") {
        if (hi <= rule.years) return { result: "meets", reason: `${label}은 ${rule.years}년 이하 조건에 들어가요.` };
        if (lo > rule.years) return { result: "notMeets", reason: `${label}은 ${rule.years}년 이하 조건을 넘어요.` };
        return { result: "check", reason: `${label} 구간이 조건 경계(${rule.years}년)에 걸쳐 있어요. 정확한 연차를 확인하세요.` };
      }
      if (lo >= rule.years) return { result: "meets", reason: `${label}은 ${rule.years}년 이상 조건에 들어가요.` };
      if (hi < rule.years) return { result: "notMeets", reason: `${label}은 ${rule.years}년 이상 조건에 못 미쳐요.` };
      return { result: "check", reason: `${label} 구간이 조건 경계(${rule.years}년)에 걸쳐 있어요. 정확한 연차를 확인하세요.` };
    }
    case "startupYearsMax": {
      if (p.startupYears === null) return { result: "noInfo", reason: "프로필에 창업 업력이 없어요." };
      return p.startupYears <= rule.years
        ? { result: "meets", reason: p.startupYears === 0 ? "아직 창업 전이라 조건에 들어가요." : `업력 ${p.startupYears}년이 ${rule.years}년 이내예요.` }
        : { result: "notMeets", reason: `업력 ${p.startupYears}년이 ${rule.years}년을 넘어요.` };
    }
    case "student": {
      if (!p.career) return { result: "noInfo", reason: "프로필에 경력 구간이 없어요." };
      return p.career === "student"
        ? { result: "meets", reason: "프로필이 학생으로 되어 있어요." }
        : { result: "check", reason: "재직 중이어도 대학원 재학 등으로 해당될 수 있어요. 재학 여부를 확인하세요." };
    }
  }
}

/** 필수 조건만 모아 결과별 개수. 점수로 바꾸지 않는다 */
export function summarizeRequired(conditions: EligibilityCondition[], profile: UserProfile | null) {
  const counts: Record<EligibilityResult, number> = { meets: 0, notMeets: 0, check: 0, noInfo: 0 };
  for (const c of conditions) if (c.kind === "required") counts[evaluateCondition(c, profile).result] += 1;
  return counts;
}
