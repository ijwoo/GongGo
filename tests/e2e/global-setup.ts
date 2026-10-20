import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "..", "scripts", "e2e-api.sh");

/**
 * 실행마다 새 DB로 E2E 백엔드를 띄운다(이전 실행의 계정·공고 변경이 남지 않게).
 * 이미 띄운 백엔드를 쓰려면 E2E_API_EXTERNAL=1과 API_BASE_URL을 준다.
 */
export default function globalSetup() {
  if (process.env.E2E_API_EXTERNAL === "1") return;
  execFileSync(SCRIPT, { stdio: "inherit" });
  return () => {
    execFileSync(SCRIPT, ["stop"], { stdio: "inherit" });
  };
}
