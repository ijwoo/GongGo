import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
/** E2E는 기준 시각을 고정한다: 2026-10-21(수) 10:00 KST */
const FIXED_NOW = "2026-10-21T01:00:00Z";

export default defineConfig({
  testDir: "tests/e2e",
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
    // API_BASE_URL이 있으면 백엔드 모드로 돌린다. 백엔드도 같은 시각으로 고정해 띄워야 한다(README 참고)
    env: { DEMO_FIXED_NOW: FIXED_NOW, ...(process.env.API_BASE_URL ? { API_BASE_URL: process.env.API_BASE_URL } : {}) },
    timeout: 120_000,
  },
});
