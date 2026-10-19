import { expect, test } from "@playwright/test";

test("지도 공고 수와 목록 수가 일치하고, 목록 ↔ 마커 선택이 연동된다", async ({ page }) => {
  // 구로 일대만 보이도록 범위를 지정한다(마커 1개)
  await page.goto("/discover?view=map&bbox=126.89,37.47,126.91,37.50");
  await expect(page.locator("[data-map-status=ready]")).toBeVisible({ timeout: 20_000 });
  const list = page.getByRole("list", { name: "지도 범위의 공고 목록" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText(/이 지역의 공고/)).toContainText("1");

  const marker = page.getByRole("button", { name: "백엔드 실무 심화 과정 (야간)", exact: true });
  await marker.click();
  await expect(page).toHaveURL(/id=ed-guro-backend/);
  await expect(list.getByRole("link", { name: "백엔드 실무 심화 과정 (야간)" })).toHaveAttribute("aria-current", "true");
  await expect(marker).toHaveAttribute("aria-pressed", "true");
});

test("목록에서 고르면 해당 마커가 강조되고, 보기 전환 후에도 선택이 유지된다", async ({ page }) => {
  await page.goto("/discover?view=map");
  await expect(page.locator("[data-map-status=ready]")).toBeVisible({ timeout: 20_000 });
  const list = page.getByRole("list", { name: "지도 범위의 공고 목록" });
  const count = await list.getByRole("listitem").count();
  await expect(page.getByText(`지도의 공고 ${count}건`).first()).toBeVisible();
  await expect(page.getByText(/온라인·장소 미정 공고 \d+건은 지도에 표시하지 않아요/)).toBeVisible();

  await list.getByRole("link", { name: "판교 생성형 AI 서비스 해커톤 2기" }).click();
  await expect(page).toHaveURL(/id=hk-pangyo-ai/);
  await expect(page.locator('button[aria-pressed="true"][aria-label*="같은 장소의 공고"], button[aria-pressed="true"][aria-label="판교 생성형 AI 서비스 해커톤 2기"]').first()).toBeAttached();

  await page.getByRole("button", { name: "목록", exact: true }).click();
  await expect(page).toHaveURL(/id=hk-pangyo-ai/);
  await expect(page.getByRole("link", { name: "판교 생성형 AI 서비스 해커톤 2기" }).first()).toHaveAttribute("aria-current", "true");
});

test("지도를 불러오지 못해도 목록은 정상 동작한다", async ({ page }) => {
  // WebGL을 쓸 수 없는 환경을 흉내 낸다
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const patched = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    };
    HTMLCanvasElement.prototype.getContext = patched as unknown as typeof original;
  });
  await page.goto("/discover?view=map");
  await expect(page.getByRole("alert").filter({ hasText: "지도를 불러오지 못했어요" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("list", { name: "지도 범위의 공고 목록" }).getByRole("listitem").first()).toBeVisible();
  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await expect(page).not.toHaveURL(/view=map/);
  await expect(page.getByRole("table")).toBeVisible();
});
