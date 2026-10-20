import type { Announcement } from "./types";

/**
 * 채용 공고 분류. 출처(Greenhouse)는 직무·경력을 따로 주지 않으므로 공고 제목에서 읽는다.
 * 한 공고가 여러 직무에 걸칠 수 있다(예: 풀스택 → 프론트엔드·백엔드, ML 인프라 → AI·데이터·인프라).
 * 제목에 단서가 없으면 그 분류의 필터를 고를 때 빠진다.
 */

export const JOB_ROLES = ["backend", "frontend", "mobile", "ai", "infra", "security", "systems", "hardware", "qa", "pm", "other"] as const;
export type JobRole = (typeof JOB_ROLES)[number];

export const JOB_ROLE_LABEL: Record<JobRole, string> = {
  backend: "백엔드",
  frontend: "프론트엔드",
  mobile: "모바일",
  ai: "AI·데이터",
  infra: "인프라·DevOps",
  security: "보안",
  systems: "시스템·컴파일러",
  hardware: "하드웨어·반도체",
  qa: "QA·테스트",
  pm: "PM·기획",
  other: "기타",
};

const ROLE_PATTERNS: [Exclude<JobRole, "other">, RegExp][] = [
  ["backend", /back-?\s?end|백엔드|server|서버|full\s?-?stack|풀스택/i],
  ["frontend", /front-?\s?end|프론트|full\s?-?stack|풀스택|client engineer/i],
  ["mobile", /android|\bios\b|mobile engineer|모바일|안드로이드/i],
  ["ai", /machine learning|\bml\b|\bai\b|\bllm|data|데이터|scientist|research|머신러닝|analytics|analyst|inference|model|agent/i],
  ["infra", /devops|\bsre\b|site reliability|network engineer|인프라|infrastructure|cloud|production engineer|release/i],
  ["security", /security|보안|threat|penetration|\biam\b|digital trust/i],
  ["systems", /compiler|kernel|firmware|driver|runtime|systems software|build system|npu management/i],
  ["hardware", /hardware|하드웨어|\bsoc\b|chip|silicon|thermal|mechanical|design verification|integrity|physical engineering|productization/i],
  ["qa", /\bqa\b|test automation|테스트/i],
  ["pm", /product manager|program manager|product owner|\bpm\b|기획/i],
];

/** 개발 직군이 아닌 공고(운영·기획 담당 등). 제목에 AI·데이터가 들어가도 개발 직무로 분류하지 않는다 */
const NON_ENGINEERING = /담당자|에디터|팀장|사업개발|specialist|운영/i;
const ENGINEERING = /engineer|scientist|analyst|developer|엔지니어|개발자/i;

export function jobRolesOf(title: string): JobRole[] {
  if (NON_ENGINEERING.test(title) && !ENGINEERING.test(title)) return ["other"];
  const roles = ROLE_PATTERNS.filter(([, re]) => re.test(title)).map(([r]) => r);
  // 컴파일러의 front-end/middle-end는 웹 프론트엔드가 아니다
  const result = roles.includes("systems") ? roles.filter((r) => r !== "frontend" && r !== "backend") : roles;
  return result.length ? result : ["other"];
}

export const JOB_LEVELS = ["intern", "entry", "experienced", "lead"] as const;
export type JobLevel = (typeof JOB_LEVELS)[number];

export const JOB_LEVEL_LABEL: Record<JobLevel, string> = {
  intern: "인턴",
  entry: "신입 가능",
  experienced: "경력",
  lead: "리더급",
};

export function jobLevelsOf(title: string): JobLevel[] {
  const levels: JobLevel[] = [];
  if (/intern|인턴/i.test(title)) levels.push("intern");
  if (/신입|junior|new grad|경력\s?무관/i.test(title)) levels.push("entry");
  // '2년 이상 / 인턴'처럼 인턴에 붙은 연차는 경력직이 아니다
  if (!levels.includes("intern") && /senior|\bsr\b|sr\.|시니어|staff|principal|경력\)|경력\/|\d+\s?년\s?이상/i.test(title)) {
    levels.push("experienced");
  }
  if (/^manager|,\s*manager|engineering manager|director|head of|\blead\b|팀장/i.test(title.replace(/^\[[^\]]*\]\s*/, ""))) levels.push("lead");
  return levels;
}

export const COMPANY_SIZES = ["large", "startup"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const COMPANY_SIZE_LABEL: Record<CompanySize, string> = {
  large: "대기업",
  startup: "스타트업",
};

/**
 * 회사 규모. 출처에 없는 정보라 여기서 정한다(공시대상기업집단 = 대기업).
 * 채용 게시판(backend sources/greenhouse-boards.yml)에 회사를 더하면 여기에도 넣는다. 없으면 규모 필터에서 빠진다.
 */
const COMPANY_SIZE: Record<string, CompanySize> = {
  쿠팡: "large",
  크래프톤: "large",
  당근: "startup",
  몰로코: "startup",
  센드버드: "startup",
  퓨리오사AI: "startup",
};

export function companySizeOf(a: Announcement): CompanySize | null {
  return COMPANY_SIZE[a.organizer.name] ?? null;
}

/** 채용 공고 회사 목록(공고 많은 순) */
export function jobCompanies(list: Announcement[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of list) if (a.category === "job") counts.set(a.organizer.name, (counts.get(a.organizer.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
}
