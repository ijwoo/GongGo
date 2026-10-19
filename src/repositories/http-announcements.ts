import { z } from "zod";
import {
  announcementSchema,
  isoInstant,
  type Announcement,
} from "@/domain/types";

/** 백엔드 목록 응답(GET /api/announcements). 공고 모양은 화면 계약을 그대로 쓴다 */
export const announcementPageSchema = z.object({
  items: z.array(announcementSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  serverTime: isoInstant,
});

/** 화면이 한 번에 받는 최대 건수(백엔드 size 상한과 같다) */
export const MAX_PAGE_SIZE = 500;

export class AnnouncementApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnnouncementApiError";
  }
}

export interface FetchedAnnouncements {
  announcements: Announcement[];
  /** 마감 판정에 쓴 서버 기준 시각. 화면 전체가 이 값을 기준으로 날짜를 계산한다 */
  serverTime: string;
  /** 상한을 넘어 일부만 받았는지 */
  truncated: boolean;
}

/**
 * 지도·요약 수치가 전체 목록을 쓰므로 1단계에서는 마감 공고까지 한 번에 받는다.
 * 응답이 계약과 다르면 화면까지 가지 않고 여기서 실패한다.
 */
export async function fetchAnnouncements(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<FetchedAnnouncements> {
  const url = new URL("/api/announcements", baseUrl);
  url.searchParams.set("includeClosed", "true");
  url.searchParams.set("size", String(MAX_PAGE_SIZE));

  let res: Response;
  try {
    res = await fetchImpl(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new AnnouncementApiError(
      `공고 API에 연결하지 못했습니다 (${url.origin})`,
      { cause },
    );
  }
  if (!res.ok)
    throw new AnnouncementApiError(
      `공고 API가 ${res.status} 응답을 보냈습니다`,
    );

  const parsed = announcementPageSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new AnnouncementApiError(
      `공고 API 응답이 계약과 다릅니다: ${z.prettifyError(parsed.error).slice(0, 500)}`,
    );
  }
  const { items, total, serverTime } = parsed.data;
  return {
    announcements: items,
    serverTime: new Date(serverTime).toISOString(),
    truncated: total > items.length,
  };
}
