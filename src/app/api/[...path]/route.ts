import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

/** /api/** → 백엔드. 운영자 API는 웹으로 열지 않는다(서버 안에서만 호출) */
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] === "admin") return Response.json({ title: "찾을 수 없습니다." }, { status: 404 });
  return proxyToApi(req, `/api/${path.map(encodeURIComponent).join("/")}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE, handle as PATCH };
