// 테스트 고정 공고를 JSON으로 내보낸다(백엔드 통합 테스트·E2E용). 기준일(anchor)과 함께 저장하고,
// 백엔드의 테스트 전용 출처(fixture)가 넣을 때 날짜를 (기준일 - anchor)만큼 옮긴다.
import { writeFileSync } from "node:fs";
import { buildFixtureAnnouncements } from "../tests/fixtures/announcements";

const anchor = "2026-01-01";
const items = buildFixtureAnnouncements(anchor);
const out = "tests/fixtures/announcements.json";
writeFileSync(out, JSON.stringify({ anchor, items }, null, 2) + "\n");
console.log(`[export-fixtures] ${items.length}건 → ${out} (anchor ${anchor})`);
