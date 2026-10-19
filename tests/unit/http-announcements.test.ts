import { describe, expect, it, vi } from "vitest";
import { buildDemoAnnouncements } from "@/data/demo-announcements";
import {
  AnnouncementApiError,
  fetchAnnouncements,
  MAX_PAGE_SIZE,
  MAX_PAGES,
} from "@/repositories/http-announcements";

const items = buildDemoAnnouncements("2026-10-21");

function respond(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("fetchAnnouncements", () => {
  it("최근 마감까지 포함한 목록을 요청하고 서버 기준 시각을 돌려준다", async () => {
    const fetchImpl = respond({
      items,
      page: 0,
      size: 500,
      total: items.length,
      serverTime: "2026-10-21T01:00:00Z",
    });

    const result = await fetchAnnouncements(
      "http://api:8080",
      fetchImpl as typeof fetch,
    );

    const url = (fetchImpl.mock.calls[0] as unknown[])[0] as URL;
    expect(url.toString()).toBe(
      "http://api:8080/api/announcements?includeClosed=true&closedWithinDays=30&size=500&page=0",
    );
    expect(result.announcements).toHaveLength(items.length);
    expect(result.serverTime).toBe("2026-10-21T01:00:00.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.truncated).toBe(false);
  });

  /** total건을 MAX_PAGE_SIZE씩 나눠 주는 가짜 API. id만 바꾼 공고를 만든다 */
  function paged(total: number) {
    return vi.fn(async (input: URL | RequestInfo) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      const count = Math.max(0, Math.min(MAX_PAGE_SIZE, total - page * MAX_PAGE_SIZE));
      const pageItems = Array.from({ length: count }, (_, i) => ({
        ...items[i % items.length],
        id: `a-${page * MAX_PAGE_SIZE + i}`,
      }));
      return new Response(
        JSON.stringify({
          items: pageItems,
          page,
          size: MAX_PAGE_SIZE,
          total,
          // 페이지마다 시각이 달라도 첫 페이지 값을 쓴다
          serverTime: `2026-10-21T01:00:0${page}Z`,
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
  }

  it("상한보다 많으면 다음 페이지를 이어 받는다", async () => {
    const fetchImpl = paged(1_200);
    const result = await fetchAnnouncements(
      "http://api:8080",
      fetchImpl as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.announcements).toHaveLength(1_200);
    expect(new Set(result.announcements.map((a) => a.id)).size).toBe(1_200);
    expect(result.serverTime).toBe("2026-10-21T01:00:00.000Z");
    expect(result.truncated).toBe(false);
  });

  it("최대 페이지를 넘으면 받은 만큼 쓰고 잘렸다고 알린다", async () => {
    const fetchImpl = paged(MAX_PAGE_SIZE * MAX_PAGES + 1);
    const result = await fetchAnnouncements(
      "http://api:8080",
      fetchImpl as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result.announcements).toHaveLength(MAX_PAGE_SIZE * MAX_PAGES);
    expect(result.truncated).toBe(true);
  });

  it("계약과 다른 응답은 화면까지 보내지 않는다", async () => {
    // 날짜만 공지된 마감에 시각을 만들어 넣은 잘못된 응답
    const broken = [
      {
        ...items[0],
        applicationDeadline: { type: "date", date: "2026-10-30T23:59" },
      },
    ];
    await expect(
      fetchAnnouncements(
        "http://api:8080",
        respond({
          items: broken,
          page: 0,
          size: 500,
          total: 1,
          serverTime: "2026-10-21T01:00:00Z",
        }) as typeof fetch,
      ),
    ).rejects.toThrow(/계약과 다릅니다/);
  });

  it("오류 응답과 연결 실패를 구분해 알린다", async () => {
    await expect(
      fetchAnnouncements("http://api:8080", respond({}, 503) as typeof fetch),
    ).rejects.toThrow(/503/);
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      fetchAnnouncements("http://api:8080", down as typeof fetch),
    ).rejects.toBeInstanceOf(AnnouncementApiError);
  });
});
