import { expect, test } from "./fixtures";

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
  await expect(page.getByText(/온라인이거나 지역을 알 수 없는 공고 \d+건은 지도에 표시하지 않아요/)).toBeVisible();

  await list.getByRole("link", { name: "판교 생성형 AI 서비스 해커톤 2기" }).click();
  await expect(page).toHaveURL(/id=hk-pangyo-ai/);
  await expect(page.locator('button[aria-pressed="true"][aria-label*="같은 장소의 공고"], button[aria-pressed="true"][aria-label="판교 생성형 AI 서비스 해커톤 2기"]').first()).toBeAttached();

  // 지도 모드에서는 옆 패널에 상세를 보여 준다
  await expect(page.getByRole("complementary", { name: "공고 상세" }).getByRole("heading", { name: "판교 생성형 AI 서비스 해커톤 2기" })).toBeVisible();

  // 목록으로 돌아가도 분야·지역 조건은 유지된다
  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await expect(page).not.toHaveURL(/view=map/);
  await expect(page.getByRole("heading", { level: 1, name: "공고 둘러보기" })).toBeVisible();
});

test("목록 ↔ 지도 전환 시 탐색 조건이 유지된다", async ({ page }) => {
  await page.goto("/discover?cat=hackathon&online=0");
  await page.getByRole("button", { name: "지도로 보기" }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(page).toHaveURL(/cat=hackathon/);
  await expect(page).toHaveURL(/online=0/);
  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await expect(page).toHaveURL(/cat=hackathon/);
  await expect(page.getByRole("switch", { name: "온라인 포함" })).toHaveAttribute("aria-checked", "false");
});

test("지도를 불러오지 못해도 목록은 정상 동작한다", async ({ page }) => {
  // 카카오맵 스크립트를 받을 수 없는 상황(키 오류·차단·장애)을 흉내 낸다
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js**", (route) => route.abort());
  await page.goto("/discover?view=map");
  await expect(page.getByRole("alert").filter({ hasText: "지도를 불러오지 못했어요" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("list", { name: "지도 범위의 공고 목록" }).getByRole("listitem").first()).toBeVisible();
  await page.getByRole("alert").getByRole("button", { name: "목록으로 보기" }).click();
  await expect(page).not.toHaveURL(/view=map/);
  await expect(page.getByRole("heading", { name: "지금 모집 중인 공고" })).toBeVisible();
});

test("정확한 장소와 대략 위치를 다른 모양으로 표시하고, 클러스터를 누르면 확대된다", async ({ page }) => {
  await page.goto("/discover?view=map");
  await expect(page.locator("[data-map-status=ready]")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("대략 위치(시·구 단위)")).toBeVisible();
  const cluster = page.getByRole("button", { name: /공고 \d+건이 모인 지역/ }).first();
  if (await cluster.count()) {
    await cluster.click();
    await expect(page.getByRole("button", { name: "이 지역 다시 검색" })).toBeVisible();
  }
});
