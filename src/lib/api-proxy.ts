import "server-only";
import type { NextRequest } from "next/server";

/**
 * 브라우저 → 웹(같은 주소) → 백엔드 프록시.
 * 로그인 세션 쿠키와 CSRF 쿠키가 웹 주소에 붙도록, 로그인·개인 데이터 요청은 모두 이 경로로 보낸다.
 * 백엔드는 X-Forwarded-* 헤더로 원래 주소(카카오 redirect_uri 등)를 계산한다.
 */
const FORWARD_REQUEST_HEADERS = ["cookie", "content-type", "accept", "x-xsrf-token", "user-agent", "accept-language"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "location", "cache-control"];

export async function proxyToApi(req: NextRequest, path: string): Promise<Response> {
  const base = process.env.API_BASE_URL?.trim();
  if (!base) return Response.json({ title: "API_BASE_URL이 설정되지 않았습니다." }, { status: 503 });

  const target = new URL(path, base);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  // 브라우저가 본 주소. 프록시(로드밸런서) 뒤라면 그쪽이 넘긴 값을 그대로 잇는다
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", proto);
  const port = host.includes(":") ? host.split(":").pop()! : proto === "https" ? "443" : "80";
  headers.set("x-forwarded-port", port);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[api-proxy] 백엔드에 연결하지 못했습니다", target.pathname, error);
    return Response.json({ title: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const v = res.headers.get(name);
    if (v) out.set(name, v);
  }
  for (const c of res.headers.getSetCookie()) out.append("set-cookie", c);
  return new Response(res.status === 204 || res.status === 304 ? null : res.body, { status: res.status, headers: out });
}
