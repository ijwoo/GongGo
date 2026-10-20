import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

/** 카카오가 돌려보내는 주소. 백엔드가 인가 코드를 교환하고 세션을 만든 뒤 /login/complete로 보낸다 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return proxyToApi(req, `/login/oauth2/code/${encodeURIComponent(provider)}`);
}
