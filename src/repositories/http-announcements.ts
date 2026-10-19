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

/** 한 번에 받는 건수(백엔드 size 상한과 같다) */
export const MAX_PAGE_SIZE = 500;
/** 이어 받을 최대 페이지 수. 넘으면 잘린 채로 쓰고 truncated로 알린다 */
export const MAX_PAGES = 10;
/** 마감·취소 공고는 최근 이 기간 안에 닫힌 것만 받는다. 지난 행사가 끝없이 쌓이지 않게 한다 */
export const CLOSED_WITHIN_DAYS = 30;

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
 * 지도·요약 수치가 전체 목록을 쓰므로 한 번에 다 받는다. 마감 공고는 최근 것만 포함한다.
 * 상한(MAX_PAGE_SIZE)을 넘으면 페이지를 이어 받는다. 응답이 계약과 다르면 화면까지 가지 않고 여기서 실패한다.
 */
export async function fetchAnnouncements(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<FetchedAnnouncements> {
  const byId = new Map<string, Announcement>();
  let serverTime: string | null = null;
  let total = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchPage(baseUrl, page, fetchImpl, timeoutMs);
    // 화면 전체가 같은 기준 시각을 써야 하므로 첫 페이지 값을 쓴다
    serverTime ??= new Date(data.serverTime).toISOString();
    total = data.total;
    // 페이지 사이에 수집이 돌아 순서가 밀려도 같은 공고가 두 번 들어가지 않게 한다
    for (const a of data.items) byId.set(a.id, a);
    if (data.items.length < MAX_PAGE_SIZE || (page + 1) * MAX_PAGE_SIZE >= total) break;
  }
  return {
    announcements: [...byId.values()],
    serverTime: serverTime!,
    truncated: total > byId.size,
  };
}

async function fetchPage(
  baseUrl: string,
  page: number,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<z.infer<typeof announcementPageSchema>> {
  const url = new URL("/api/announcements", baseUrl);
  url.searchParams.set("includeClosed", "true");
  url.searchParams.set("closedWithinDays", String(CLOSED_WITHIN_DAYS));
  url.searchParams.set("size", String(MAX_PAGE_SIZE));
  url.searchParams.set("page", String(page));

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
  return parsed.data;
}
