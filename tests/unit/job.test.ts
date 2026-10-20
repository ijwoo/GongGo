import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_QUERY, filterAnnouncements, isCuratedQuery, parseDiscoverQuery, serializeDiscoverQuery } from "@/domain/discover";
import { jobLevelsOf, jobRolesOf } from "@/domain/job";
import type { Announcement } from "@/domain/types";
import { newId } from "@/hooks/use-personal";
import { ANNOUNCEMENTS, NOW } from "./fixtures";

describe("채용 공고 제목 분류(실제 제목)", () => {
  it("직무를 읽고, 여러 직무에 걸치면 모두 붙인다", () => {
    expect(jobRolesOf("Staff, Back-end Engineer (Global Operations Technology)")).toEqual(["backend"]);
    expect(jobRolesOf("Software Engineer, Frontend - 커뮤니티")).toEqual(["frontend"]);
    expect(jobRolesOf("Software Engineer, iOS")).toEqual(["mobile"]);
    expect(jobRolesOf("[AI Frontier Div.] AI Native Full Stack Engineer (5년 이상)")).toEqual(["backend", "frontend", "ai"]);
    expect(jobRolesOf("Software Engineer, Machine Learning - ML 인프라")).toEqual(["ai", "infra"]);
    expect(jobRolesOf("Staff Security Engineer (Penetration Tester)")).toEqual(["security"]);
  });

  it("컴파일러의 front-end는 웹 프론트엔드가 아니고, 개발 직군이 아닌 공고는 기타다", () => {
    expect(jobRolesOf("Software Engineer, Compiler (Front-end)")).toEqual(["systems"]);
    expect(jobRolesOf("[쿠팡] AI CS 품질 관리 담당자")).toEqual(["other"]);
    expect(jobRolesOf("Expression of Interest(채용관심등록): Software Engineer - Korea")).toEqual(["other"]);
  });

  it("경력: 인턴·신입·경력·리더급", () => {
    expect(jobLevelsOf("Software Engineer, Backend (인턴) - Cross Product Growth (Chatting)")).toEqual(["intern"]);
    expect(jobLevelsOf("[AI Research Div.] Research Scientist - Specialized Model (2년 이상 / 인턴)")).toEqual(["intern"]);
    expect(jobLevelsOf("Software Engineer, Backend (신입) - 피드 (ML Data Platform)")).toEqual(["entry"]);
    expect(jobLevelsOf("Senior Staff Data Scientist")).toEqual(["experienced"]);
    expect(jobLevelsOf("Manager, Back-end Engineering (Rocket Pay)")).toEqual(["lead"]);
    expect(jobLevelsOf("Senior Product Manager (Finance Platform & Accounting Engineering)")).toEqual(["experienced"]);
    expect(jobLevelsOf("Software Engineer, Backend - 광고")).toEqual([]);
  });
});

function job(id: string, title: string, company: string): Announcement {
  const base = ANNOUNCEMENTS[0];
  return { ...base, id, title, category: "job", organizer: { ...base.organizer, name: company } };
}

describe("채용 필터", () => {
  const list = [
    ...ANNOUNCEMENTS,
    job("j1", "Staff Back-end Engineer (Rocket Pay)", "쿠팡"),
    job("j2", "Software Engineer, Frontend (신입) - 커뮤니티", "당근"),
    job("j3", "Software Engineer, Backend (인턴)", "당근"),
  ];
  const ids = (patch: Partial<typeof DEFAULT_QUERY>) =>
    filterAnnouncements(list, { ...DEFAULT_QUERY, includeClosed: true, ...patch }, NOW).map((a) => a.id).sort();

  it("조건 안에서는 하나라도, 조건끼리는 모두 맞아야 하고, 채용이 아닌 공고는 빠진다", () => {
    expect(ids({ roles: ["backend"] })).toEqual(["j1", "j3"]);
    expect(ids({ roles: ["backend", "frontend"], levels: ["intern", "entry"] })).toEqual(["j2", "j3"]);
    expect(ids({ sizes: ["large"] })).toEqual(["j1"]);
    expect(ids({ companies: ["당근"], roles: ["backend"] })).toEqual(["j3"]);
  });

  it("URL에 담았다 복원되고, 고르면 큐레이션 대신 결과 목록을 보여 준다", () => {
    const q = { ...DEFAULT_QUERY, roles: ["backend" as const], levels: ["entry" as const], sizes: ["startup" as const], companies: ["당근", "쿠팡"] };
    expect(parseDiscoverQuery(new URLSearchParams(serializeDiscoverQuery(q)))).toEqual(q);
    expect(isCuratedQuery(q)).toBe(false);
    expect(parseDiscoverQuery({ role: "backend,nope", co: " 당근 ,," })).toMatchObject({ roles: ["backend"], companies: ["당근"] });
  });
});

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("http(보안 컨텍스트 아님)처럼 randomUUID가 없어도 UUID v4를 만든다", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(id);
  });
});
