import "server-only";
import { connection } from "next/server";
import { buildDemoAnnouncements } from "@/data/demo-announcements";
import { seoulDateOf } from "@/domain/time";
import { announcementSchema, type Announcement } from "@/domain/types";
import { getRequestNow } from "@/lib/server-clock";
import { fetchAnnouncements } from "./http-announcements";

export interface AnnouncementSnapshot {
  announcements: Announcement[];
  /** 요청 기준 시각. 서버 렌더링과 브라우저가 같은 값을 쓴다 */
  now: string;
  source: "demo" | "api";
}

/**
 * 공고 저장소 경계. 화면은 이 인터페이스만 안다.
 * - API_BASE_URL이 있으면 백엔드(Spring Boot, backend/)에서 읽고, 기준 시각도 백엔드의 serverTime을 쓴다.
 * - 없으면 브라우저 데모와 같은 데모 데이터를 쓴다.
 */
export interface AnnouncementRepository {
  load(): Promise<AnnouncementSnapshot>;
}

class DemoAnnouncementRepository implements AnnouncementRepository {
  async load(): Promise<AnnouncementSnapshot> {
    const now = await getRequestNow();
    // 데모 데이터도 경계에서 스키마 검증을 거친다. 잘못된 데이터가 화면까지 가지 않게 한다.
    const announcements = announcementSchema
      .array()
      .parse(buildDemoAnnouncements(seoulDateOf(now)));
    return { announcements, now, source: "demo" };
  }
}

class HttpAnnouncementRepository implements AnnouncementRepository {
  constructor(private readonly baseUrl: string) {}

  async load(): Promise<AnnouncementSnapshot> {
    await connection(); // 요청마다 새로 읽는다
    const { announcements, serverTime, truncated } = await fetchAnnouncements(
      this.baseUrl,
    );
    if (truncated)
      console.warn(
        "[announcements] 공고가 받을 수 있는 최대 페이지를 넘어 일부만 받았습니다.",
      );
    return { announcements, now: serverTime, source: "api" };
  }
}

export function getAnnouncementRepository(): AnnouncementRepository {
  const baseUrl = process.env.API_BASE_URL?.trim();
  return baseUrl
    ? new HttpAnnouncementRepository(baseUrl)
    : new DemoAnnouncementRepository();
}
