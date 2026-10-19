import "server-only";
import { connection } from "next/server";

/**
 * 요청 시점의 기준 시각. 서버에서 한 번 정해 화면 전체에 내려 준다.
 * 같은 값을 서버 렌더링과 브라우저 hydration이 함께 쓰므로 날짜가 어긋나지 않는다.
 * 테스트·시연에서는 DEMO_FIXED_NOW(ISO)로 고정할 수 있다.
 */
export async function getRequestNow(): Promise<string> {
  await connection();
  const fixed = process.env.DEMO_FIXED_NOW;
  if (fixed && !Number.isNaN(Date.parse(fixed))) return new Date(fixed).toISOString();
  return new Date().toISOString();
}
