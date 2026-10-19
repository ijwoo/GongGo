import { expect, type Page } from "@playwright/test";

/** 데모 로그인(로그인 화면 경유) */
export async function loginDemo(page: Page, next = "/discover") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "데모로 체험하기" }).click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
}

export function resultCount(page: Page) {
  return page.locator("p[aria-live=polite]").filter({ hasText: "공고" }).locator("b");
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}
