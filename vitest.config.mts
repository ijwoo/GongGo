import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    // 서버·브라우저 시간대와 무관하게 동작하는지 확인하려고 일부러 서울이 아닌 시간대로 돌린다
    env: { TZ: "America/Los_Angeles" },
    setupFiles: ["tests/unit/setup.ts"],
  },
});
