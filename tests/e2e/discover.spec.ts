import { expect, test } from "./fixtures";
import { resultCount } from "./helpers";

test("검색·필터·정렬이 URL에 반영되고, 새로고침·뒤로 가기로 복원된다", async ({ page }) => {
  await page.goto("/discover");
  const total = Number(await resultCount(page).innerText());
  expect(total).toBeGreaterThan(20);

  await page.getByRole("button", { name: "해커톤", exact: true }).click();
  await expect(page).toHaveURL(/cat=hackathon/);
  const hackathons = Number(await resultCount(page).innerText());
  expect(hackathons).toBeLessThan(total);

  await page.getByRole("button", { name: /^필터(,.*)?$/ }).click();
  await page.getByRole("dialog", { name: "필터" }).getByRole("button", { name: "경기", exact: true }).click();
  await expect(page).toHaveURL(/region=%EA%B2%BD%EA%B8%B0|region=경기/);
  await page.keyboard.press("Escape");
  await page.getByLabel("정렬").selectOption("recent");
  await expect(page).toHaveURL(/sort=recent/);
  const narrowed = Number(await resultCount(page).innerText());

  await page.reload();
  await expect(page.getByRole("button", { name: "해커톤", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "경기 필터 해제" })).toBeVisible();
  await expect(page.getByLabel("정렬")).toHaveValue("recent");
  await expect(resultCount(page)).toHaveText(String(narrowed));

  await page.goBack();
  await expect(page).not.toHaveURL(/sort=recent/);
  await page.goBack();
  await expect(page).not.toHaveURL(/region=/);
  await expect(resultCount(page)).toHaveText(String(hackathons));
});

test("검색어 입력과 빈 결과", async ({ page }) => {
  await page.goto("/discover");
  await page.getByLabel("결과 내 검색").fill("판교");
  await expect(page).toHaveURL(/q=%ED%8C%90%EA%B5%90|q=판교/);
  await expect(page.getByRole("link", { name: "판교 생성형 AI 서비스 해커톤 2기" }).first()).toBeVisible();
  await page.getByLabel("결과 내 검색").fill("존재하지않는공고");
  await expect(page.getByText("조건에 맞는 공고가 없어요")).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화" }).last().click();
  await expect(page).toHaveURL(/\/discover$/);
});

test("행을 선택하면 상세가 열리고, 주소로 바로 들어와도 복원된다", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("link", { name: "기후테크 아이디어 해커톤" }).first().click();
  await expect(page).toHaveURL(/id=hk-seongsu-climate/);
  const detail = page.getByRole("complementary", { name: "공고 상세" });
  await expect(detail.getByRole("heading", { name: "기후테크 아이디어 해커톤" })).toBeVisible();
  await expect(detail.getByText("마감 시각 미공지").or(detail.getByText(/시각 미공지/)).first()).toBeVisible();
  await expect(detail.getByRole("link", { name: /원문 보기.*새 창/ })).toHaveAttribute("rel", "noopener noreferrer");

  await page.goto("/discover?id=su-gyeonggi-early");
  await expect(detail.getByRole("heading", { name: "초기창업기업 스케일업 프로그램" })).toBeVisible();
  await expect(detail.getByText("예산 소진 시 마감").first()).toBeVisible();
});

test("관심 저장·비교 버튼은 행 선택을 일으키지 않는다", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("checkbox", { name: "비교에 담기: 기후테크 아이디어 해커톤" }).check();
  await expect(page).not.toHaveURL(/id=/);
  await page.getByRole("button", { name: "관심 공고에 저장: 기후테크 아이디어 해커톤" }).click();
  await expect(page.getByRole("dialog", { name: "로그인이 필요해요" })).toBeVisible();
  await expect(page).not.toHaveURL(/id=/);
});

test("요약 스트립 수치는 필터 결과와 같다", async ({ page }) => {
  await page.goto("/discover");
  const weekText = await page.getByRole("link", { name: /이번 주 마감/ }).innerText();
  const n = Number(weekText.match(/(\d+)건/)![1]);
  await page.getByRole("link", { name: /이번 주 마감/ }).click();
  await expect(page).toHaveURL(/quick=week/);
  await expect(resultCount(page)).toHaveText(String(n));
});
