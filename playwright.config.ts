import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
/**
 * E2E는 실제 백엔드에 붙는다. globalSetup이 scripts/e2e-api.sh로 새 DB + 테스트 고정 공고 + 고정 시각
 * (2026-10-21 10:00 KST) + 테스트 로그인을 켠 API를 띄운다(도커·자바 필요).
 * 테스트마다 새 테스트 계정으로 로그인하므로 병렬로 돌아도 서로 데이터가 섞이지 않는다.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    // 브라우저 시간대가 서울이 아니어도 날짜가 같아야 한다
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/discover`,
    reuseExistingServer: !process.env.CI,
    // 지도 키는 아무 값이나 넣고, SDK 요청은 테스트가 가짜 SDK로 바꾼다(tests/e2e/fixtures.ts)
    env: { API_BASE_URL, KAKAO_MAP_JS_KEY: "e2e-test-key" },
    timeout: 120_000,
  },
});
