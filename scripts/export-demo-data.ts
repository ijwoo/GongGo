// 웹 데모 공고를 백엔드 시드(JSON)로 내보낸다. 기준일(anchor)과 함께 저장하고,
// 백엔드는 처음 넣을 때 날짜를 (오늘 - anchor)만큼 옮긴다.
import { writeFileSync } from "node:fs";
import { buildDemoAnnouncements } from "../src/data/demo-announcements";

const anchor = "2026-01-01";
const items = buildDemoAnnouncements(anchor);
const out = "backend/src/main/resources/demo/announcements.json";
writeFileSync(out, JSON.stringify({ anchor, items }, null, 2) + "\n");
console.log(`[export-demo-data] ${items.length}건 → ${out} (anchor ${anchor})`);
