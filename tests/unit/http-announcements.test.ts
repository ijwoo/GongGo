import { describe, expect, it, vi } from "vitest";
import { buildDemoAnnouncements } from "@/data/demo-announcements";
import {
  AnnouncementApiError,
  fetchAnnouncements,
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
  it("전체 목록을 요청하고 서버 기준 시각을 돌려준다", async () => {
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
      "http://api:8080/api/announcements?includeClosed=true&size=500",
    );
    expect(result.announcements).toHaveLength(items.length);
    expect(result.serverTime).toBe("2026-10-21T01:00:00.000Z");
    expect(result.truncated).toBe(false);
  });

  it("상한보다 많으면 잘렸다고 알린다", async () => {
    const result = await fetchAnnouncements(
      "http://api:8080",
      respond({
        items,
        page: 0,
        size: 500,
        total: 900,
        serverTime: "2026-10-21T01:00:00Z",
      }) as typeof fetch,
    );
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
