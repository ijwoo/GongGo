import { describe, expect, it } from "vitest";
import { groupForLevel } from "@/components/discover/map-canvas";
import { mapPointOf, venueShort } from "@/domain/announcement";
import { filterAnnouncements, parseDiscoverQuery, venueRegionOf, withinBbox } from "@/domain/discover";
import type { Announcement } from "@/domain/types";
import { NOW, byId } from "./fixtures";

/** Dev-Event처럼 '서울 강남구'까지만 알려진 공고 */
function areaAnnouncement(id: string, label: string, coordinates?: { lat: number; lng: number }): Announcement {
  return { ...byId("hk-tbd-fintech"), id, venue: { status: "tbd", note: `${label} · 상세 장소는 원문 확인`, area: { label, coordinates } } };
}

describe("시·구 단위 지역(대략 위치)", () => {
  it("정확한 장소와 대략 위치를 구분하고, 좌표가 없으면 지도에 넣지 않는다", () => {
    expect(mapPointOf(byId("ed-guro-backend"))?.precision).toBe("exact");
    expect(mapPointOf(areaAnnouncement("x", "서울 강남구", { lat: 37.5172, lng: 127.0473 }))).toEqual({ lat: 37.5172, lng: 127.0473, precision: "area" });
    expect(mapPointOf(areaAnnouncement("y", "광주"))).toBeNull();
    expect(mapPointOf(byId("ev-online-devrel"))).toBeNull();
  });

  it("목록 장소 표기와 지역 필터에 지역 이름을 쓴다", () => {
    const a = areaAnnouncement("x", "경기 성남", { lat: 37.42, lng: 127.12 });
    expect(venueShort(a)).toBe("경기 성남");
    expect(venueRegionOf(a)).toBe("경기");
    expect(venueRegionOf(areaAnnouncement("g", "광주"))).toBe("광주");
    const list = [a, areaAnnouncement("s", "서울 강남구")];
    expect(filterAnnouncements(list, parseDiscoverQuery({ region: "경기" }), NOW).map((x) => x.id)).toEqual(["x"]);
  });

  it("지도 범위에는 대략 위치가 있는 공고도 들어간다", () => {
    const a = areaAnnouncement("x", "서울 강남구", { lat: 37.5172, lng: 127.0473 });
    expect(withinBbox([a], [127.0, 37.5, 127.1, 37.55])).toEqual([a]);
    expect(withinBbox([a], [126.0, 35.0, 126.5, 35.5])).toEqual([]);
  });
});

describe("지도 마커 묶기", () => {
  const near = [
    areaAnnouncement("a", "서울 강남구", { lat: 37.5172, lng: 127.0473 }),
    areaAnnouncement("b", "서울 강남구", { lat: 37.5172, lng: 127.0473 }),
    areaAnnouncement("c", "서울 서초구", { lat: 37.4837, lng: 127.0324 }),
  ];

  it("같은 위치는 확대해도 하나로 묶는다", () => {
    const groups = groupForLevel(near, 4);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.ids.length === 2)).toMatchObject({ cluster: false, precision: "area" });
  });

  it("멀리서 보면 가까운 위치끼리 묶고, 개수는 유지된다", () => {
    const groups = groupForLevel(near, 11);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ cluster: true });
    expect(groups[0].ids.sort()).toEqual(["a", "b", "c"]);
  });
});
