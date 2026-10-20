import { expect, test } from "./fixtures";

test("모바일: 곧 마감하는 공고가 먼저, 카드는 가로로 넘겨 보기, 필터 시트, 상세 이동", async ({ page }) => {
  await page.goto("/discover");
  const cards = page.getByRole("list", { name: "지금 신청할 수 있는 공고" }).getByRole("listitem");
  await expect(cards).toHaveCount(6);
  const tops = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1); // 한 줄로 가로 스크롤
  const closingTop = await page.locator("section[aria-labelledby=closing-soon-title-top]").evaluate((e) => e.getBoundingClientRect().top);
  expect(closingTop).toBeLessThan(tops[0]); // 곧 마감하는 공고가 카드보다 위

  await page.getByRole("button", { name: /^필터(,.*)?$/ }).click();
  const filter = page.getByRole("dialog", { name: "필터" });
  await filter.getByRole("button", { name: "상시 모집" }).click();
  await filter.getByRole("button", { name: /공고 \d+건 보기/ }).click();
  await expect(page).toHaveURL(/status=rolling/);

  await page.getByRole("button", { name: "채용", exact: true }).scrollIntoViewIfNeeded();
  await page.goto("/discover?all=1");
  await page.getByRole("link", { name: "기후테크 아이디어 해커톤" }).click();
  await expect(page).toHaveURL(/\/announcements\/hk-seongsu-climate/);
});

test("모바일: 가로 넘침이 없다", async ({ page }) => {
  for (const path of ["/discover", "/discover?all=1", "/discover?view=map", "/announcements/hk-pangyo-ai", "/compare", "/calendar", "/login"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
