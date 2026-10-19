// 백엔드 API가 웹 데모 데이터·필터와 같은 결과를 내는지 확인한다.
// 사용: API를 GONGGO_DEMO_ANCHOR_DATE=2026-10-21, 고정 시각 2026-10-21T01:00:00Z로 띄운 뒤
//   API_BASE_URL=http://localhost:8080 npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts/check-api-parity.ts
import { isDeepStrictEqual } from "node:util";
import { buildDemoAnnouncements } from "../src/data/demo-announcements";
import {
  filterAnnouncements,
  parseDiscoverQuery,
} from "../src/domain/discover";
import { seoulDateOf } from "../src/domain/time";
import { announcementSchema, type Announcement } from "../src/domain/types";

const base = process.env.API_BASE_URL ?? "http://localhost:8080";

async function get(path: string) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<{
    items: unknown[];
    total: number;
    serverTime: string;
  }>;
}

/** 시각 문자열의 표기 차이(.000Z ↔ Z)는 같은 값으로 본다 */
function canon(v: unknown): unknown {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v))
    return new Date(v).toISOString();
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, canon(x)]),
    );
  return v;
}

async function main() {
  let failed = 0;
  const all = await get("/api/announcements?includeClosed=true&size=500");
  const now = all.serverTime;
  const api = announcementSchema.array().parse(all.items);
  const web = buildDemoAnnouncements(seoulDateOf(now));
  console.log(
    `serverTime ${now}, API ${api.length}건, 웹 데모 ${web.length}건 — zod 검증 통과`,
  );

  const webById = new Map(web.map((a) => [a.id, a]));
  for (const a of api) {
    const w = webById.get(a.id);
    if (!w || !isDeepStrictEqual(canon(a), canon(w))) {
      failed++;
      console.log(`✗ 내용 다름: ${a.id}`);
      if (w)
        for (const k of Object.keys(w) as (keyof Announcement)[]) {
          if (!isDeepStrictEqual(canon(a[k]), canon(w[k])))
            console.log(
              `   ${k}: api=${JSON.stringify(a[k])} web=${JSON.stringify(w[k])}`,
            );
        }
    }
  }

  const queries = [
    "",
    "closed=1",
    "cat=hackathon,event",
    "region=서울",
    "mode=online",
    "q=판교",
    "sort=recent",
    "closed=1&sort=recent",
    "cat=startup&closed=1",
  ];
  for (const qs of queries) {
    const p = new URLSearchParams(qs);
    const apiQs = new URLSearchParams({ size: "500" });
    for (const k of ["q", "cat", "region", "mode", "sort"])
      if (p.get(k)) apiQs.set(k, p.get(k)!);
    if (p.get("closed") === "1") apiQs.set("includeClosed", "true");
    const res = await get(`/api/announcements?${apiQs}`);
    const apiIds = (res.items as Announcement[]).map((a) => a.id);
    const webIds = filterAnnouncements(web, parseDiscoverQuery(p), now).map(
      (a) => a.id,
    );
    const ok = isDeepStrictEqual(apiIds, webIds);
    if (!ok) failed++;
    console.log(
      `${ok ? "✓" : "✗"} [${qs || "기본"}] api ${apiIds.length} / web ${webIds.length}${ok ? "" : `\n   api: ${apiIds.join(",")}\n   web: ${webIds.join(",")}`}`,
    );
  }
  if (failed) {
    console.error(`불일치 ${failed}건`);
    process.exit(1);
  }
  console.log("모두 일치");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
