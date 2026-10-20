import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base } from "@playwright/test";

const FAKE_KAKAO = readFileSync(join(__dirname, "fake-kakao-maps.js"), "utf8");

/**
 * 모든 E2E 페이지에서 카카오맵 SDK 요청을 가짜 SDK로 바꾼다(키·외부 네트워크 없이 지도 흐름을 검증).
 * 실패를 흉내 낼 테스트는 page.route로 같은 주소를 다시 가로채면 된다(나중에 등록한 쪽이 먼저 처리).
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://dapi.kakao.com/v2/maps/sdk.js**", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_KAKAO }),
    );
    await provide(page);
  },
});

export { expect } from "@playwright/test";
