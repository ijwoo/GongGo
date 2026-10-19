import { z } from "zod";
import { conditionRuleSchema } from "@/domain/types";

/**
 * AI가 돌려줄 수 있는 결과의 형식. 이 스키마를 통과하지 못한 결과는 버리고 원문 정보만 보여 준다.
 * - 모든 조건에는 원문 근거 문장(evidence)이 있어야 한다.
 * - 날짜·금액은 만들지 않는다(스키마에 자리 자체가 없다).
 * - 불확실하면 rule을 비워 두어 화면에서 '확인 필요'로 보이게 한다.
 */
export const structuredConditionSchema = z.object({
  kind: z.enum(["required", "preferred"]),
  text: z.string().min(1).max(120),
  evidence: z.string().min(1).max(500),
  rule: conditionRuleSchema.optional(),
});

export const conditionExtractionSchema = z.object({
  announcementId: z.string(),
  contentVersion: z.number().int().positive(),
  conditions: z.array(structuredConditionSchema).max(30),
});
export type ConditionExtraction = z.infer<typeof conditionExtractionSchema>;

export const changeSummarySchema = z.object({
  announcementId: z.string(),
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive(),
  summary: z.string().min(1).max(200),
});
export type ChangeSummary = z.infer<typeof changeSummarySchema>;

/** 근거 문장이 실제 원문에 있는지 확인한다. 없으면 AI가 지어낸 것으로 보고 버린다 */
export function keepGroundedConditions(result: ConditionExtraction, sourceText: string): ConditionExtraction {
  const normalized = sourceText.replace(/\s+/g, " ");
  return {
    ...result,
    conditions: result.conditions.filter((c) => normalized.includes(c.evidence.replace(/\s+/g, " "))),
  };
}
