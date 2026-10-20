import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";

/** 테스트 계정으로 로그인(로그인 화면의 테스트 로그인 버튼 경유). 테스트마다 새 계정이다 */
export async function login(page: Page, next = "/discover") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "테스트 계정으로 로그인" }).click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
}

export function resultCount(page: Page) {
  return page.locator("p[aria-live=polite]").filter({ hasText: "공고" }).locator("b");
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}

const OVERRIDES = join(__dirname, "..", "..", ".e2e", "fixture-overrides.json");

/**
 * 출처에서 공고가 바뀐 상황을 만든다: 고정 공고 덮어쓰기 파일을 고치고 운영자 API로 다시 수집한다.
 * 백엔드는 실제 수집 경로(변경 감지 → 이력·버전 → 관심/일정 사용자에게 알림)를 그대로 탄다.
 */
export async function changeFixture(request: APIRequestContext, id: string, patch: Record<string, unknown>) {
  mkdirSync(join(OVERRIDES, ".."), { recursive: true });
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(readFileSync(OVERRIDES, "utf8"));
  } catch {
    // 처음
  }
  writeFileSync(OVERRIDES, JSON.stringify({ ...current, [id]: patch }));
  const res = await request.post(`${API_BASE_URL}/api/admin/ingestions/fixture`, { headers: { "X-Admin-Token": "e2e-admin-token" } });
  expect(res.ok()).toBe(true);
  expect((await res.json()).changedCount).toBeGreaterThan(0);
}
