import { expect, test } from "./fixtures";

function count(page: import("@playwright/test").Page) {
  return page.locator("p[aria-live=polite]").filter({ hasText: "공고" }).locator("b");
}

test("첫 화면은 사실에 맞는 두 큐레이션 섹션과 마감·일정 영역을 보여 준다", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { level: 1, name: "공고 둘러보기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "지금 모집 중인 공고" })).toBeVisible();
  await expect(page.getByText("행사가 가까운 순")).toBeVisible();
  await expect(page.getByRole("heading", { name: "새로 올라온 공고" })).toBeVisible();
  await expect(page.getByRole("list", { name: "지금 신청할 수 있는 공고" }).getByRole("listitem")).toHaveCount(6);
  await expect(page.getByRole("list", { name: "새로 올라온 공고" }).getByRole("listitem")).toHaveCount(3);
  // 추천 점수·참가자 수 같은 근거 없는 표시가 없다
  await expect(page.getByText(/관심 분야 기반 추천|참가자 \d+|평점/)).toHaveCount(0);

  const closing = page.getByRole("region", { name: "곧 마감하는 공고" }).or(page.locator("section[aria-labelledby=closing-soon-title]"));
  await expect(closing.getByRole("link")).toHaveCount(3);
  // 마감일이 확인된 공고만: 시각이 없으면 23:59를 지어내지 않고 '시각 미공지'
  await expect(closing.getByText("23:59")).toHaveCount(0);
  await expect(page.locator("section[aria-labelledby=my-schedule-title]").getByText(/로그인하면 저장한 공고/)).toBeVisible();
});

test("전체 보기 수와 실제 카드 수가 같고, 분야·지역·온라인 조건이 URL로 복원된다", async ({ page }) => {
  await page.goto("/discover");
  const allText = await page.getByRole("button", { name: /전체 공고 보기/ }).innerText();
  const total = Number(allText.match(/(\d+)건/)![1]);
  await page.getByRole("button", { name: /전체 공고 보기/ }).click();
  await expect(page).toHaveURL(/all=1/);
  await expect(count(page)).toHaveText(String(total));
  await expect(page.getByRole("list", { name: "공고 목록" }).getByRole("listitem")).toHaveCount(total);

  await page.getByRole("button", { name: "해커톤", exact: true }).click();
  await expect(page).toHaveURL(/cat=hackathon/);
  const hackathons = Number(await count(page).innerText());
  expect(hackathons).toBeLessThan(total);
  await expect(page.getByRole("list", { name: "공고 목록" }).getByRole("listitem")).toHaveCount(hackathons);

  await page.getByLabel("행사 장소 지역").selectOption({ label: "서울·경기" });
  await expect(page).toHaveURL(/region=/);
  const withOnline = Number(await count(page).innerText());
  await page.getByRole("switch", { name: "온라인 포함" }).click();
  await expect(page).toHaveURL(/online=0/);
  const withoutOnline = Number(await count(page).innerText());
  expect(withoutOnline).toBeLessThanOrEqual(withOnline);

  await page.reload();
  await expect(page.getByRole("button", { name: "해커톤", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("switch", { name: "온라인 포함" })).toHaveAttribute("aria-checked", "false");
  await expect(count(page)).toHaveText(String(withoutOnline));

  await page.goBack();
  await expect(page).not.toHaveURL(/online=0/);
  await expect(count(page)).toHaveText(String(withOnline));
});

test("검색·세부 필터는 하나의 결과 그리드로 보여 주고, 빈 결과에서 초기화할 수 있다", async ({ page }) => {
  await page.goto("/discover");
  const search = page.getByRole("search").getByRole("searchbox");
  await search.fill("판교");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=%ED%8C%90%EA%B5%90|q=판교/);
  await expect(page.getByRole("heading", { name: "‘판교’ 검색 결과" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "지금 모집 중인 공고" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "판교 생성형 AI 서비스 해커톤 2기" })).toBeVisible();

  await page.getByRole("button", { name: /^필터(,.*)?$/ }).click();
  await page.getByRole("dialog", { name: "필터" }).getByRole("button", { name: "상시 모집" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("조건에 맞는 공고가 없어요")).toBeVisible();
  await page.getByRole("button", { name: "조건 초기화" }).last().click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "지금 모집 중인 공고" })).toBeVisible();
});

test("카드를 누르면 상세 페이지로 가고, 뒤로 가면 조건과 스크롤이 그대로다", async ({ page }) => {
  await page.goto("/discover?all=1&sort=recent");
  const card = page.getByRole("link", { name: "기후테크 아이디어 해커톤" });
  await card.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(200);
  await card.click();
  await expect(page).toHaveURL(/\/announcements\/hk-seongsu-climate$/);
  const detail = page.getByRole("region", { name: "공고 상세" });
  await expect(detail.getByRole("heading", { name: "기후테크 아이디어 해커톤" })).toBeVisible();
  await expect(detail.getByText(/시각 미공지/).first()).toBeVisible();
  await expect(detail.getByRole("link", { name: /원문 보기.*새 창/ })).toHaveAttribute("rel", "noopener noreferrer");

  await page.getByRole("link", { name: "공고 둘러보기" }).click();
  await expect(page).toHaveURL(/\/discover\?.*all=1/);
  await expect(page).toHaveURL(/sort=recent/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 150);

  // 주소로 바로 들어와도, 예전 주소(/discover?id=)로 들어와도 상세가 열린다
  await page.goto("/announcements/su-gyeonggi-early");
  await expect(detail.getByText("예산 소진 시 마감").first()).toBeVisible();
  await page.goto("/discover?id=su-gyeonggi-early");
  await expect(page).toHaveURL(/\/announcements\/su-gyeonggi-early$/);
  await page.goto("/announcements/none");
  await expect(page.getByText("공고를 찾을 수 없어요")).toBeVisible();
});

test("저장 버튼은 카드 이동과 분리되어 있고, 키보드로 카드와 저장에 닿는다", async ({ page }) => {
  await page.goto("/discover?all=1");
  await page.getByRole("button", { name: "관심 공고에 저장: 기후테크 아이디어 해커톤" }).click();
  await expect(page.getByRole("dialog", { name: "로그인이 필요해요" })).toBeVisible();
  await expect(page).toHaveURL(/\/discover/);
  await page.keyboard.press("Escape");

  const link = page.getByRole("link", { name: "기후테크 아이디어 해커톤" });
  await link.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "관심 공고에 저장: 기후테크 아이디어 해커톤" })).toBeFocused();
  // 링크 안에 버튼이 들어 있지 않다
  expect(await page.locator("a button, button a").count()).toBe(0);
});

test("카드는 행사일과 신청 마감을 나눠 쓰고, 마감 임박만 강조한다", async ({ page }) => {
  await page.goto("/discover?all=1");
  const items = page.getByRole("list", { name: "공고 목록" }).getByRole("listitem");
  const pangyo = items.filter({ has: page.getByRole("link", { name: "판교 생성형 AI 서비스 해커톤 2기" }) });
  await expect(pangyo.getByText("행사 11.09–11.10")).toBeVisible();
  await expect(pangyo.getByText("마감 10.26")).toBeVisible();
  const rolling = items.filter({ has: page.getByRole("link", { name: "1:1 창업 멘토링 상시 신청" }) });
  await expect(rolling.getByText("상시 모집")).toBeVisible();
  // 같은 줄의 카드 높이(제목 2줄 확보)가 같다
  const heights = await items.evaluateAll((els) => els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);
});
