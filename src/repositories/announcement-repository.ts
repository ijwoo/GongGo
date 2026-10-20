import "server-only";
import { connection } from "next/server";
import type { Announcement } from "@/domain/types";
import { AnnouncementApiError, fetchAnnouncements } from "./http-announcements";

export interface AnnouncementSnapshot {
  announcements: Announcement[];
  /** 요청 기준 시각(백엔드 serverTime). 서버 렌더링과 브라우저가 같은 값을 쓴다 */
  now: string;
}

/**
 * 공고 저장소 경계. 화면은 이 함수만 안다.
 * 공고는 백엔드(Spring Boot, backend/)에서만 읽는다. 응답은 경계에서 Zod로 검증한다.
 */
export async function loadAnnouncements(): Promise<AnnouncementSnapshot> {
  await connection(); // 요청마다 새로 읽는다
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) throw new AnnouncementApiError("API_BASE_URL이 설정되지 않았습니다.");
  const { announcements, serverTime, truncated } = await fetchAnnouncements(baseUrl);
  if (truncated) console.warn("[announcements] 공고가 받을 수 있는 최대 페이지를 넘어 일부만 받았습니다.");
  return { announcements, now: serverTime };
}
