import { expect, test } from "@playwright/test";

test("모바일: 목록 → 상세 바텀시트 → 닫기, 필터 시트", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("table")).toBeHidden();
  await page.getByRole("list", { name: "공고 목록" }).getByRole("link", { name: "기후테크 아이디어 해커톤" }).click();
  const sheet = page.getByRole("dialog", { name: "기후테크 아이디어 해커톤" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(page).not.toHaveURL(/id=/);

  await page.getByRole("button", { name: /^필터(,.*)?$/ }).click();
  const filter = page.getByRole("dialog", { name: "필터" });
  await filter.getByRole("button", { name: "교육", exact: true }).click();
  await filter.getByRole("button", { name: /공고 \d+건 보기/ }).click();
  await expect(page).toHaveURL(/cat=education/);
});

test("모바일: 가로 넘침이 없다", async ({ page }) => {
  for (const path of ["/discover", "/discover?view=map", "/compare", "/calendar", "/login"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
