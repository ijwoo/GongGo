import "server-only";
import { buildDemoAnnouncements } from "@/data/demo-announcements";
import { seoulDateOf } from "@/domain/time";
import { announcementSchema, type Announcement } from "@/domain/types";

/**
 * 공고 저장소 경계. 화면은 이 인터페이스만 안다.
 * 실제 DB(PostgreSQL 등)를 붙일 때는 같은 인터페이스로 구현체를 바꾸고,
 * 발견 화면의 필터(`filterAnnouncements`)는 같은 query 스키마로 서버 쿼리로 옮긴다.
 */
export interface AnnouncementRepository {
  list(): Promise<Announcement[]>;
}

class DemoAnnouncementRepository implements AnnouncementRepository {
  constructor(private readonly nowIso: string) {}

  async list(): Promise<Announcement[]> {
    // 데모 데이터도 경계에서 스키마 검증을 거친다. 잘못된 데이터가 화면까지 가지 않게 한다.
    return announcementSchema.array().parse(buildDemoAnnouncements(seoulDateOf(this.nowIso)));
  }
}

export function getAnnouncementRepository(nowIso: string): AnnouncementRepository {
  return new DemoAnnouncementRepository(nowIso);
}
