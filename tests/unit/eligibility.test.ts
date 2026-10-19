import { describe, expect, it } from "vitest";
import { evaluateCondition, summarizeRequired } from "@/domain/eligibility";
import type { EligibilityCondition, UserProfile } from "@/domain/types";

const profile: UserProfile = { interests: ["hackathon"], region: "서울", career: "3-5", teamSize: 3, startupYears: 0 };
const cond = (rule?: EligibilityCondition["rule"]): EligibilityCondition => ({
  id: "c",
  kind: "required",
  text: "t",
  evidence: "e",
  origin: "ai-demo",
  rule,
});

describe("프로필 조건 비교", () => {
  it("규칙이 없는 조건은 단정하지 않고 확인 필요", () => {
    expect(evaluateCondition(cond(), profile).result).toBe("check");
  });
  it("프로필이 없으면 입력 정보 없음", () => {
    expect(evaluateCondition(cond({ type: "region", regions: ["서울"] }), null).result).toBe("noInfo");
  });
  it("지역", () => {
    expect(evaluateCondition(cond({ type: "region", regions: ["서울", "경기"] }), profile).result).toBe("meets");
    expect(evaluateCondition(cond({ type: "region", regions: ["경기"] }), profile).result).toBe("notMeets");
  });
  it("경력 구간이 조건 경계에 걸치면 확인 필요", () => {
    expect(evaluateCondition(cond({ type: "careerMaxYears", years: 3 }), profile).result).toBe("check");
    expect(evaluateCondition(cond({ type: "careerMaxYears", years: 5 }), profile).result).toBe("meets");
    expect(evaluateCondition(cond({ type: "careerMaxYears", years: 2 }), profile).result).toBe("notMeets");
    expect(evaluateCondition(cond({ type: "careerMinYears", years: 1 }), profile).result).toBe("meets");
  });
  it("팀 규모·업력·입력 없음", () => {
    expect(evaluateCondition(cond({ type: "teamSize", min: 2, max: 4 }), profile).result).toBe("meets");
    expect(evaluateCondition(cond({ type: "teamSize", max: 1 }), profile).result).toBe("notMeets");
    expect(evaluateCondition(cond({ type: "startupYearsMax", years: 3 }), profile).result).toBe("meets");
    expect(evaluateCondition(cond({ type: "teamSize", max: 4 }), { ...profile, teamSize: null }).result).toBe("noInfo");
  });
  it("요약은 개수만 세고 점수를 만들지 않는다", () => {
    const s = summarizeRequired([cond(), cond({ type: "region", regions: ["서울"] })], profile);
    expect(s).toEqual({ meets: 1, notMeets: 0, check: 1, noInfo: 0 });
  });
});
