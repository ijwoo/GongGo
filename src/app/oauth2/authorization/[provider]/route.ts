import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

/** 카카오 로그인 시작 → 백엔드가 카카오 인증 화면으로 보낸다 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return proxyToApi(req, `/oauth2/authorization/${encodeURIComponent(provider)}`);
}
