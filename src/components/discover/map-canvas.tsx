"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle, LocateFixed, Minus, Plus, RefreshCw, ScanSearch } from "lucide-react";
import type { GeoJSONSource, Map as MlMap, Marker, Popup, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { AREA_LABELS } from "@/data/places";
import type { Bbox } from "@/domain/discover";
import type { LocatedAnnouncement } from "@/domain/announcement";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Located = LocatedAnnouncement;

/** 운영용 지도 스타일 URL. 없으면 외부 타일 없이 그리는 예시 지도를 쓴다 */
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || null;
/** 서울·경기 밖으로 멀리 나가지 않게 해 불필요한 타일 요청을 막는다 */
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [125.9, 36.6],
  [128.3, 38.4],
];
const DEFAULT_CENTER: [number, number] = [126.98, 37.5];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

/** 외부 타일 없이 배경과 위경도 격자만 그리는 예시 지도 스타일 */
function demoStyle(): StyleSpecification {
  const lines: GeoJSON.Feature[] = [];
  for (let lng = 126; lng <= 128.2; lng += 0.1)
    lines.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lng, 36.6], [lng, 38.4]] } });
  for (let lat = 36.6; lat <= 38.4; lat += 0.1)
    lines.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[125.9, lat], [128.3, lat]] } });
  return {
    version: 8,
    sources: { grid: { type: "geojson", data: { type: "FeatureCollection", features: lines } } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": cssVar("--map-bg") } },
      { id: "grid", type: "line", source: "grid", paint: { "line-color": cssVar("--map-grid"), "line-width": 1 } },
    ],
  };
}

interface LocationGroup {
  key: string;
  coordinates: [number, number];
  ids: string[];
}

/** 같은 장소의 공고는 하나의 위치로 묶는다(겹친 마커가 서로 가리지 않게) */
function groupByLocation(items: Located[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();
  for (const a of items) {
    const { lat, lng } = a.venue.coordinates;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const g = map.get(key) ?? { key, coordinates: [lng, lat], ids: [] };
    g.ids.push(a.id);
    map.set(key, g);
  }
  return [...map.values()];
}

function toGeoJson(groups: LocationGroup[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: groups.map((g) => ({
      type: "Feature",
      properties: { key: g.key, count: g.ids.length },
      geometry: { type: "Point", coordinates: g.coordinates },
    })),
  };
}

export interface MapCanvasProps {
  items: Located[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 적용된 지도 범위(URL) */
  appliedBbox: Bbox | null;
  onSearchArea: (bbox: Bbox) => void;
  onShowList: () => void;
}

type Status = "loading" | "ready" | "error";

export function MapCanvas({ items, selectedId, onSelect, appliedBbox, onSearchArea, onShowList }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const popupRef = useRef<Popup | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const appliedBboxRef = useRef(appliedBbox);
  const userMoveRef = useRef(false);

  // 최신 props를 지도 이벤트 핸들러에서 읽기 위한 참조
  const latest = useRef({ items, selectedId, onSelect });
  useEffect(() => {
    latest.current = { items, selectedId, onSelect };
  });

  const groups = groupByLocation(items);
  const groupsRef = useRef(groups);
  useEffect(() => {
    groupsRef.current = groups;
  });

  function syncMarkers() {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !map.getSource("ann") || !map.isSourceLoaded("ann")) return;
    const { items: currentItems, selectedId: sel } = latest.current;
    const byKey = new Map(groupsRef.current.map((g) => [g.key, g]));
    const seen = new Set<string>();
    for (const f of map.querySourceFeatures("ann")) {
      const props = f.properties as Record<string, unknown>;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const isCluster = Boolean(props.cluster);
      const id = isCluster ? `c${props.cluster_id}` : `p${props.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const group = isCluster ? null : byKey.get(String(props.key));
      const containsSelected = group ? group.ids.includes(sel ?? "") : false;
      const label = isCluster
        ? `공고 ${props.total}건이 모인 지역. 눌러서 확대`
        : group && group.ids.length > 1
          ? `같은 장소의 공고 ${group.ids.length}건`
          : (currentItems.find((a) => a.id === group?.ids[0])?.title ?? "공고");
      let marker = markersRef.current.get(id);
      if (!marker) {
        // MapLibre가 바깥 요소의 class·transform을 관리하므로 모양은 안쪽 버튼에만 준다
        const wrapper = document.createElement("div");
        const button = document.createElement("button");
        button.type = "button";
        wrapper.append(button);
        marker = new lib.Marker({ element: wrapper }).setLngLat(coords).addTo(map);
        markersRef.current.set(id, marker);
        button.addEventListener("click", (ev) => {
          ev.stopPropagation();
          handleMarkerClick(id, coords, props);
        });
      }
      marker.getElement().style.zIndex = containsSelected ? "5" : isCluster ? "2" : "1";
      const el = marker.getElement().firstElementChild as HTMLButtonElement;
      el.setAttribute("aria-label", label);
      el.title = label;
      el.dataset.markerId = id;
      el.className = markerClass(isCluster, containsSelected);
      el.textContent = isCluster ? String(props.total) : group && group.ids.length > 1 ? String(group.ids.length) : "";
      el.setAttribute("aria-pressed", String(containsSelected));
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
  }

  async function handleMarkerClick(id: string, coords: [number, number], props: Record<string, unknown>) {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    if (id.startsWith("c")) {
      const source = map.getSource("ann") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(Number(props.cluster_id));
      userMoveRef.current = true;
      map.easeTo({ center: coords, zoom: Math.min(zoom, 16) });
      return;
    }
    const group = groupsRef.current.find((g) => g.key === props.key);
    if (!group) return;
    if (group.ids.length === 1) {
      latest.current.onSelect(group.ids[0]);
      return;
    }
    // 같은 장소의 여러 공고: 작은 목록을 띄워 고르게 한다
    popupRef.current?.remove();
    const box = document.createElement("div");
    box.className = "min-w-52 text-[13px]";
    const heading = document.createElement("p");
    heading.className = "mb-1 text-xs font-semibold text-[var(--muted)]";
    heading.textContent = `같은 장소의 공고 ${group.ids.length}건`;
    box.append(heading);
    for (const aid of group.ids) {
      const a = latest.current.items.find((x) => x.id === aid);
      if (!a) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "block w-full rounded px-1.5 py-1 text-left hover:bg-[var(--subtle)]";
      b.textContent = a.title;
      b.addEventListener("click", () => {
        latest.current.onSelect(aid);
        popupRef.current?.remove();
      });
      box.append(b);
    }
    popupRef.current = new lib.Popup({ closeButton: true, offset: 14, className: "gg-popup", maxWidth: "280px" })
      .setLngLat(coords)
      .setDOMContent(box)
      .addTo(map);
    box.querySelector("button")?.focus();
  }

  /* 지도 생성 */
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;
    (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        libRef.current = lib;
        lib.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
        const map = new lib.Map({
          container: containerRef.current,
          style: STYLE_URL ?? demoStyle(),
          center: DEFAULT_CENTER,
          zoom: 9.3,
          minZoom: 8,
          maxZoom: 16,
          maxBounds: MAX_BOUNDS,
          attributionControl: STYLE_URL ? { compact: true } : false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();

        map.on("error", (e) => {
          // 스타일·타일을 못 불러온 경우. 목록은 계속 쓸 수 있도록 지도 영역에만 안내한다
          if (!map.isStyleLoaded()) {
            setStatus("error");
            setError(e.error?.message ?? "지도 데이터를 불러오지 못했어요.");
          }
        });

        map.on("load", () => {
          if (cancelled) return;
          map.addSource("ann", {
            type: "geojson",
            data: toGeoJson(groupsRef.current),
            cluster: true,
            clusterRadius: 44,
            clusterMaxZoom: 13,
            clusterProperties: { total: ["+", ["get", "count"]] },
          });
          // 마커는 HTML로 그리지만, 소스 데이터를 계산하려면 소스를 쓰는 레이어가 하나 필요하다
          map.addLayer({ id: "ann-anchor", type: "circle", source: "ann", paint: { "circle-radius": 0, "circle-opacity": 0 } });
          if (!STYLE_URL) addAreaLabels(lib, map);
          setStatus("ready");
          if (appliedBboxRef.current) {
            const [a, b, c, d] = appliedBboxRef.current;
            map.fitBounds([[a, b], [c, d]], { duration: 0 });
          } else fitToItems(map, groupsRef.current, 0);
          setMoved(false);
        });

        map.on("moveend", (e) => {
          // 사용자가 직접 움직인 경우에만 '이 지역 다시 검색'을 보여 준다
          if ((e as { originalEvent?: unknown }).originalEvent || userMoveRef.current) setMoved(true);
          userMoveRef.current = false;
        });
        map.on("render", () => syncMarkers());
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // attempt가 바뀌면 다시 시도한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  /* 데이터가 바뀌면 소스를 갱신 */
  const dataKey = groups.map((g) => `${g.key}:${g.ids.join("|")}`).join(";");
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("ann") as GeoJSONSource | undefined;
    if (!map || !source) return;
    source.setData(toGeoJson(groupsRef.current));
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, status]);

  /* 적용 범위가 바뀌면(뒤로 가기 등) 지도도 맞춘다 */
  const bboxKey = appliedBbox?.join(",") ?? "";
  useEffect(() => {
    appliedBboxRef.current = appliedBbox;
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    if (appliedBbox) {
      const [a, b, c, d] = appliedBbox;
      map.fitBounds([[a, b], [c, d]], { duration: 0 });
    }
    setMoved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey, status]);

  /* 선택이 바뀌면 마커를 강조하고, 보이지 않으면 지도를 옮긴다 */
  useEffect(() => {
    const map = mapRef.current;
    syncMarkers();
    if (!map || status !== "ready" || !selectedId) return;
    const a = items.find((x) => x.id === selectedId);
    if (!a) return;
    const { lng, lat } = a.venue.coordinates;
    if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat], duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status]);

  /* 테마가 바뀌면 예시 지도 색을 맞춘다 */
  useEffect(() => {
    if (STYLE_URL) return;
    const observer = new MutationObserver(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      map.setPaintProperty("bg", "background-color", cssVar("--map-bg"));
      map.setPaintProperty("grid", "line-color", cssVar("--map-grid"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const zoomBy = (delta: number) => {
    userMoveRef.current = true;
    mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 10) + delta, { duration: 200 });
  };

  const locate = () => {
    setGeoMessage(null);
    if (!("geolocation" in navigator)) {
      setGeoMessage("이 브라우저는 위치 기능을 지원하지 않아요. 지도를 직접 움직여 찾아 주세요.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        const [[minLng, minLat], [maxLng, maxLat]] = MAX_BOUNDS;
        if (longitude < minLng || longitude > maxLng || latitude < minLat || latitude > maxLat) {
          setGeoMessage("현재 위치가 서비스 지역(서울·경기) 밖이에요.");
          return;
        }
        userMoveRef.current = true;
        mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 13 });
      },
      (err) =>
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부되어 내 위치로 이동할 수 없어요. 지도를 직접 움직이거나 목록에서 찾아 주세요."
            : "현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
        ),
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  const searchHere = () => {
    const b = mapRef.current?.getBounds();
    if (!b) return;
    onSearchArea([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setMoved(false);
  };

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-[var(--map-bg)]" data-map-status={status}>
      <div ref={containerRef} className="h-full w-full" aria-label="공고 위치 지도. 모든 공고는 목록에서도 볼 수 있습니다." role="region" />

      <div className="pointer-events-none absolute top-2 left-2 z-[2] flex max-w-[calc(100%-64px)] flex-col items-start gap-1">
        <p className="rounded-sm bg-panel/95 px-2 py-1 text-xs font-semibold shadow-sm">
          {STYLE_URL ? "행사·교육 장소 기준" : "예시 지도 · 실제 지도 타일이 아니에요"}
        </p>
        {!STYLE_URL ? (
          <p className="rounded-sm bg-panel/95 px-2 py-1 text-[11px] text-muted shadow-sm">행사·교육 장소만 표시 · 지역명 위치는 대략적이에요</p>
        ) : null}
      </div>

      {moved && status === "ready" ? (
        <div className="absolute top-12 left-1/2 z-[2] -translate-x-1/2">
          <Button variant="primary" size="sm" onClick={searchHere} className="shadow-[var(--shadow)]">
            <ScanSearch className="size-4" aria-hidden />이 지역 다시 검색
          </Button>
        </div>
      ) : null}

      <div className="absolute top-2 right-2 z-[2] flex flex-col overflow-hidden rounded-md border border-line bg-panel shadow-sm">
        <button type="button" aria-label="지도 확대" onClick={() => zoomBy(1)} disabled={status !== "ready"} className="inline-flex size-9 items-center justify-center hover:bg-subtle disabled:opacity-40">
          <Plus className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label="지도 축소" onClick={() => zoomBy(-1)} disabled={status !== "ready"} className="inline-flex size-9 items-center justify-center border-t border-line hover:bg-subtle disabled:opacity-40">
          <Minus className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label="내 위치로 이동" onClick={locate} disabled={status !== "ready"} className="inline-flex size-9 items-center justify-center border-t border-line hover:bg-subtle disabled:opacity-40">
          <LocateFixed className="size-4" aria-hidden />
        </button>
      </div>

      {geoMessage ? (
        <div role="status" className="absolute inset-x-2 bottom-2 z-[2] rounded-md bg-panel px-3 py-2 text-[13px] shadow-[var(--shadow)]">
          {geoMessage}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[var(--map-bg)] text-[13px] text-muted" role="status">
          지도를 불러오는 중…
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 bg-[var(--map-bg)] px-6 text-center" role="alert">
          <AlertTriangle className="size-6 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">지도를 불러오지 못했어요</p>
            <p className="mt-1 text-[13px] text-muted">목록은 그대로 사용할 수 있어요. 모든 공고를 목록에서 볼 수 있어요.</p>
            {error ? <p className="mt-1 text-xs text-faint">({error})</p> : null}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw className="size-4" aria-hidden />
              다시 시도
            </Button>
            <Button variant="primary" onClick={onShowList}>
              목록으로 보기
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function markerClass(cluster: boolean, selected: boolean): string {
  if (cluster) {
    return "flex size-9 items-center justify-center rounded-full border-2 border-[var(--panel)] bg-[var(--fg)] text-[13px] font-bold text-[var(--page)] shadow-md hover:scale-105 focus-visible:outline-2";
  }
  return cn(
    "flex items-center justify-center rounded-full border-2 border-[var(--panel)] text-[11px] font-bold text-white shadow-md transition-transform hover:scale-110",
    selected ? "z-10 size-8 scale-110 bg-[var(--accent)] ring-4 ring-[var(--accent)]/30" : "size-6 bg-[#5b6573]",
  );
}

function fitToItems(map: MlMap, groups: LocationGroup[], duration: number) {
  if (groups.length === 0) return;
  const lngs = groups.map((g) => g.coordinates[0]);
  const lats = groups.map((g) => g.coordinates[1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 48, maxZoom: 13, duration },
  );
}

/** 예시 지도의 지역 이름 표식(외부 글꼴 없이 HTML로 그린다) */
function addAreaLabels(lib: typeof import("maplibre-gl"), map: MlMap) {
  for (const l of AREA_LABELS) {
    const el = document.createElement("span");
    el.className = "pointer-events-none select-none text-[11px] font-medium text-[var(--faint)]";
    el.setAttribute("aria-hidden", "true");
    el.textContent = l.name;
    new lib.Marker({ element: el }).setLngLat([l.coordinates.lng, l.coordinates.lat]).addTo(map);
  }
}
