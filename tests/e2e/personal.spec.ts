import { expect, test } from "./fixtures";
import { expectToast, login } from "./helpers";

test("비로그인 저장 → 로그인 → 원래 동작 완료 → 서버에 저장돼 새로고침 후에도 유지", async ({ page }) => {
  await page.goto("/discover");
  const star = page.getByRole("button", { name: /관심 공고에 저장: 백엔드 실무 심화 과정/ });
  await star.click();
  const dialog = page.getByRole("dialog", { name: "로그인이 필요해요" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "카카오로 로그인" })).toBeVisible();
  await dialog.getByRole("button", { name: "테스트 계정으로 로그인" }).click();
  await expect(dialog).toBeHidden();
  await expectToast(page, "로그인했어요");
  await expect(page.getByRole("button", { name: /관심 공고에서 빼기: 백엔드 실무 심화 과정/ })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("button", { name: /관심 공고에서 빼기: 백엔드 실무 심화 과정/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "관심 공고", exact: true }).click();
  await expect(page.getByRole("link", { name: "백엔드 실무 심화 과정 (야간)" })).toBeVisible();
});

test("캘린더 추가 버튼도 로그인 후 원래 동작(일정 추가 창)으로 이어진다", async ({ page }) => {
  await page.goto("/discover?id=hk-pangyo-ai");
  await page.getByRole("complementary", { name: "공고 상세" }).getByRole("button", { name: "내 캘린더에 추가" }).click();
  await page.getByRole("dialog", { name: "로그인이 필요해요" }).getByRole("button", { name: "테스트 계정으로 로그인" }).click();
  await expect(page.getByRole("dialog", { name: "내 캘린더에 추가" })).toBeVisible();
});

test("비교는 최대 3개까지 담는다", async ({ page }) => {
  await page.goto("/discover");
  const boxes = page.getByRole("checkbox", { name: /비교에 담기/ });
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await expect(page.getByRole("link", { name: /공고 비교/ })).toContainText("3");
  await boxes.nth(3).click();
  await expectToast(page, "최대 3개");
  await expect(boxes.nth(3)).not.toBeChecked();

  await page.getByRole("link", { name: /공고 비교/ }).click();
  const table = page.getByRole("table", { name: /선택한 공고 3개 비교/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "준비 서류" })).toBeVisible();
  await table.getByRole("button", { name: /비교에서 빼기/ }).first().click();
  await expect(page.getByRole("table", { name: /선택한 공고 2개 비교/ })).toBeVisible();
});

test("로그인이 필요한 화면은 이유를 설명하고 로그인을 안내한다", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByText("로그인이 필요한 화면이에요")).toBeVisible();
  await expect(page.getByRole("button", { name: "카카오로 로그인" })).toBeVisible();
  await page.getByRole("button", { name: "테스트 계정으로 로그인" }).click();
  await expect(page.getByRole("heading", { name: "내 캘린더" })).toBeVisible();
});

test("로그인 화면은 외부 주소로 돌려보내지 않는다", async ({ page }) => {
  await page.goto("/login?next=//evil.example.com");
  await page.getByRole("button", { name: "테스트 계정으로 로그인" }).click();
  await expect(page).toHaveURL(/\/discover$/);
});

test("프로필을 입력하면 조건 비교 결과가 바뀐다", async ({ page }) => {
  await login(page, "/settings");
  await page.getByLabel("활동 지역").selectOption("경기");
  await page.getByRole("button", { name: "프로필 저장" }).click();
  await expectToast(page, "프로필을 저장했어요");
  await page.goto("/discover?id=hk-gwanggyo-mobility&closed=1");
  const detail = page.getByRole("complementary", { name: "공고 상세" });
  const item = detail.getByRole("listitem").filter({ hasText: "경기도 소재 대학 재학생 또는 경기도민" });
  await expect(item.getByText("해당", { exact: true })).toBeVisible();
  await item.getByText(/근거 문장/).click();
  await expect(item.getByText("“경기도 소재 대학 재학생 또는 경기도 거주자”")).toBeVisible();
});

test("로그아웃하면 개인 데이터가 화면에서 사라지고, 다시 로그인하면 돌아온다(다른 계정과 섞이지 않는다)", async ({ page, context }) => {
  await login(page, "/discover");
  await page.getByRole("button", { name: /관심 공고에 저장: 백엔드 실무 심화 과정/ }).click();
  await expect(page.getByRole("button", { name: /관심 공고에서 빼기: 백엔드 실무 심화 과정/ })).toBeVisible();

  await page.getByRole("button", { name: "사용자 메뉴" }).click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expectToast(page, "로그아웃했어요");
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /관심 공고에 저장: 백엔드 실무 심화 과정/ })).toHaveAttribute("aria-pressed", "false");

  // 다른 테스트 계정으로 들어가면 앞 계정의 저장 공고가 보이지 않는다
  await login(page, "/saved");
  await expect(page.getByRole("link", { name: "백엔드 실무 심화 과정 (야간)" })).toHaveCount(0);
  expect((await context.cookies()).find((c) => c.name === "GONGGO_SESSION")?.httpOnly).toBe(true);
});

test("탈퇴하면 계정과 데이터가 지워진다", async ({ page }) => {
  await login(page, "/settings");
  await page.getByRole("button", { name: "회원 탈퇴" }).click();
  await page.getByRole("button", { name: "탈퇴하기" }).click();
  await expectToast(page, "탈퇴했어요");
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
});
