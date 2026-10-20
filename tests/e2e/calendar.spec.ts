import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { changeFixture, expectToast, login } from "./helpers";

async function addDeadline(page: Page, id: string) {
  await page.goto(`/announcements/${id}`);
  const detail = page.getByRole("region", { name: "공고 상세" });
  await detail.getByRole("button", { name: "내 캘린더에 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "내 캘린더에 추가" });
  await dialog.getByRole("radio", { name: /신청 마감/ }).check();
  await dialog.getByRole("button", { name: "다음" }).click();
  return dialog;
}

test("캘린더 등록 → 수정 → 삭제", async ({ page }) => {
  await login(page);
  const dialog = await addDeadline(page, "hk-pangyo-ai");
  await expect(dialog.getByText("10월 26일 (월) 18:00")).toBeVisible();
  await dialog.getByRole("button", { name: "다음" }).click();
  await expect(dialog.getByRole("checkbox", { name: "3일 전" })).toBeChecked();
  await dialog.getByRole("checkbox", { name: "당일" }).check();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expectToast(page, "신청 마감");

  // 같은 종류는 다시 추가할 수 없다
  await page.getByRole("region", { name: "공고 상세" }).getByRole("button", { name: "내 캘린더에 추가" }).click();
  await expect(page.getByRole("dialog", { name: "내 캘린더에 추가" }).getByText("이미 내 캘린더에 있어요.")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/calendar?date=2026-10-26");
  const day = page.getByRole("region", { name: /10월 26일/ }).or(page.locator("section", { has: page.getByRole("heading", { name: /10월 26일/ }) }));
  await expect(day.getByText("판교 생성형 AI 서비스 해커톤 2기 신청 마감").first()).toBeVisible();
  await day.getByRole("button", { name: /일정 수정/ }).first().click();
  const editor = page.getByRole("dialog", { name: "일정 수정" });
  await editor.getByLabel("일정 이름").fill("판교 해커톤 지원서 마감");
  await editor.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("판교 해커톤 지원서 마감").first()).toBeVisible();
  // 저장 후 수정 창이 닫히고 주소에서 event가 빠질 때까지 기다린 뒤 새로고침한다
  await expect(page.getByRole("dialog", { name: "일정 수정" })).toBeHidden();
  await expect(page).not.toHaveURL(/event=/);

  await page.reload();
  await page.getByRole("button", { name: "일정 수정: 판교 해커톤 지원서 마감" }).first().click();
  await page.getByRole("dialog", { name: "일정 수정" }).getByRole("button", { name: "일정 삭제" }).click();
  await expect(page.getByText("이 일정과 예약된 알림을 삭제할까요?")).toBeVisible();
  await page.getByRole("dialog", { name: "일정 수정" }).getByRole("button", { name: "삭제", exact: true }).click();
  await expectToast(page, "일정을 삭제했어요");
  await expect(page.getByText("판교 해커톤 지원서 마감")).toHaveCount(0);
});

test("마감 시각이 없는 공고는 종일 일정으로 등록하고 시각을 지어내지 않는다", async ({ page }) => {
  await login(page);
  const dialog = await addDeadline(page, "ed-pyeongchon-cloud");
  await expect(dialog.getByText(/시각 미공지/)).toBeVisible();
  await expect(dialog.getByText(/마감 시각이 공지되지 않아 날짜만 등록해요/)).toBeVisible();
  await dialog.getByRole("button", { name: "다음" }).click();
  await expect(dialog.getByText(/10월 22일 \(목\) 09:00/)).toBeVisible(); // 3일 전 오전 9시
  await dialog.getByRole("button", { name: "저장" }).click();
  await page.goto("/calendar?date=2026-10-25");
  await expect(page.getByText("시각 미공지").first()).toBeVisible();
  await expect(page.getByText("23:59")).toHaveCount(0);
});

test("상시 모집 공고는 마감 일정을 만들 수 없다고 안내한다", async ({ page }) => {
  await login(page);
  await page.goto("/announcements/su-rolling-mentoring");
  await page.getByRole("region", { name: "공고 상세" }).getByRole("button", { name: "내 캘린더에 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "내 캘린더에 추가" });
  await expect(dialog.getByRole("radio", { name: /신청 마감/ })).toBeDisabled();
  await expect(dialog.getByText("상시 모집이라 마감일이 없어요.")).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /준비 일정/ })).toBeChecked();
});

test("출처에서 마감이 바뀌면 → 서버가 알림 → 일정 변경 확인 → 갱신", async ({ page, request }) => {
  await login(page);
  // 딥테크 액셀러레이팅: 마감 11월 2일(월) 18:00
  const dialog = await addDeadline(page, "su-pangyo-accel");
  await expect(dialog.getByText("11월 2일 (월) 18:00")).toBeVisible();
  await dialog.getByRole("button", { name: "다음" }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expectToast(page, "신청 마감");

  // 수집기가 원문 변경(마감 3일 연장)을 감지한다
  await changeFixture(request, "su-pangyo-accel", { applicationDeadline: { type: "datetime", at: "2026-11-05T09:00:00Z" } });

  await page.goto("/notifications");
  await expect(page.getByText("마감일이 바뀌었어요")).toBeVisible();
  await expect(page.getByText(/11월 2일 \(월\) 18:00 → 11월 5일 \(목\) 18:00/)).toBeVisible();
  await expect(page.getByRole("link", { name: /알림, 읽지 않은 알림 1개/ })).toBeVisible();
  await page.getByRole("button", { name: "모두 읽음" }).click();
  await expect(page.getByText("안 읽음 0")).toBeVisible();

  await page.goto("/calendar");
  const review = page.locator("section", { has: page.getByRole("heading", { name: /변경 확인 필요 1건/ }) });
  await expect(review.getByText("11월 2일 (월) 18:00").first()).toBeVisible();
  await expect(review.getByText(/바뀔 일정: 11월 5일 \(목\) 18:00/)).toBeVisible();
  await review.getByRole("button", { name: "변경 내용으로 갱신" }).click();
  await expect(page.getByRole("heading", { name: /변경 확인 필요/ })).toHaveCount(0);

  // 서버에 저장돼 새로고침해도 갱신된 일정이 남는다
  await page.goto("/calendar?date=2026-11-05");
  await expect(page.getByText("딥테크 액셀러레이팅 배치 7기 신청 마감").first()).toBeVisible();
  // 새 시각 기준으로 알림이 다시 계산된다(3일 전 = 11월 2일 18:00)
  await page.goto("/notifications");
  await expect(page.getByText(/11월 2일 \(월\) 18:00/).first()).toBeVisible();
});

test(".ics 파일을 내려받는다", async ({ page }) => {
  await login(page);
  const dialog = await addDeadline(page, "hk-pangyo-ai");
  await dialog.getByRole("button", { name: "다음" }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await page.goto("/calendar");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: ".ics 내보내기" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("gonggoham-2026-10-21.ics");
  const text = await (await file.createReadStream()).toArray();
  const ics = Buffer.concat(text).toString("utf8");
  expect(ics).toContain("BEGIN:VCALENDAR\r\n");
  expect(ics).toContain("DTSTART:20261026T090000Z");
});
