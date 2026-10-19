import { buildDemoAnnouncements } from "@/data/demo-announcements";
import type { Announcement } from "@/domain/types";

/** 테스트용 고정 시각: 2026-10-21(수) 10:00 KST */
export const NOW = "2026-10-21T01:00:00.000Z";
export const TODAY = "2026-10-21";

export const ANNOUNCEMENTS: Announcement[] = buildDemoAnnouncements(TODAY);

export function byId(id: string): Announcement {
  const a = ANNOUNCEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`no announcement ${id}`);
  return a;
}

let seq = 0;
export const testId = () => `id-${++seq}`;
