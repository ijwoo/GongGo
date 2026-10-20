"use client";

import { AlertTriangle, LocateFixed, Minus, Plus, RefreshCw, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { mapPointOf, type MapPoint } from "@/domain/announcement";
import type { Bbox } from "@/domain/discover";
import type { Announcement } from "@/domain/types";
import { useKakaoMapKey } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { loadKakaoMaps, type KakaoMaps, type KCustomOverlay, type KMap } from "@/lib/kakao-maps";

/** 카카오맵 확대 수준: 1(가장 가까이) ~ 14(가장 멀리). 전국이 보이는 정도까지만 허용한다 */
const MIN_LEVEL = 3;
const MAX_LEVEL = 13;
/** 이 수준부터는 가까운 공고를 한 원으로 묶는다 */
const CLUSTER_FROM_LEVEL = 7;
const KOREA = { minLat: 33, maxLat: 38.7, minLng: 124.5, maxLng: 131 };

interface Group {
  key: string;
  lat: number;
  lng: number;
  ids: string[];
  /** 서로 다른 장소를 화면 축척 때문에 묶은 것 */
  cluster: boolean;
  precision: MapPoint["precision"];
}

/** 같은 위치의 공고는 하나로, 멀리서 볼 때는 가까운 위치끼리 격자로 묶는다 */
export function groupForLevel(items: Announcement[], level: number): Group[] {
  const places = new Map<string, Group>();
  for (const a of items) {
    const p = mapPointOf(a);
    if (!p) continue;
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const g = places.get(key) ?? { key: `p${key}`, lat: p.lat, lng: p.lng, ids: [], cluster: false, precision: p.precision };
    g.ids.push(a.id);
    if (p.precision === "exact") g.precision = "exact";
    places.set(key, g);
  }
  if (level < CLUSTER_FROM_LEVEL) return [...places.values()];
  // 화면 너비의 약 1/10 거리 안의 위치를 한 원으로 묶는다(레벨이 하나 오를 때마다 두 배).
  // 고정 격자는 경계 양쪽의 가까운 위치를 갈라 놓으므로, 묶음 중심과의 거리로 정한다
  const reach = 0.0005 * 2 ** (level - 3);
  const clusters: { lat: number; lng: number; members: Group[] }[] = [];
  for (const g of [...places.values()].sort((x, y) => y.ids.length - x.ids.length || x.key.localeCompare(y.key))) {
    const c = clusters.find((k) => Math.abs(k.lat - g.lat) < reach && Math.abs(k.lng - g.lng) < reach);
    if (!c) {
      clusters.push({ lat: g.lat, lng: g.lng, members: [g] });
      continue;
    }
    c.members.push(g);
    const total = c.members.reduce((n, m) => n + m.ids.length, 0);
    c.lat = c.members.reduce((sum, m) => sum + m.lat * m.ids.length, 0) / total;
    c.lng = c.members.reduce((sum, m) => sum + m.lng * m.ids.length, 0) / total;
  }
  return clusters.map((c) =>
    c.members.length === 1
      ? c.members[0]
      : {
          key: `c${c.members.map((m) => m.key).sort()[0]}`,
          lat: c.lat,
          lng: c.lng,
          ids: c.members.flatMap((m) => m.ids),
          cluster: true,
          precision: c.members.some((m) => m.precision === "exact") ? "exact" : "area",
        },
  );
}

export interface MapCanvasProps {
  items: Announcement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 같은 장소의 여러 공고 마커를 눌렀을 때 */
  onPickPlace: (ids: string[]) => void;
  /** 고른 장소의 공고(강조 표시) */
  pickedIds?: string[] | null;
  /** 적용된 지도 범위(URL) */
  appliedBbox: Bbox | null;
  onSearchArea: (bbox: Bbox) => void;
  onShowList: () => void;
  /** 지도 위에 뜬 패널이 가린 왼쪽·오른쪽 너비(px). 조작 버튼과 공고 맞추기를 그만큼 비켜 둔다 */
  insetLeft?: number;
  insetRight?: number;
}

type Status = "loading" | "ready" | "error" | "nokey";

interface Marker {
  overlay: KCustomOverlay;
  button: HTMLButtonElement;
  group: Group;
}

export function MapCanvas({ items, selectedId, onSelect, onPickPlace, pickedIds = null, appliedBbox, onSearchArea, onShowList, insetLeft = 0, insetRight = 0 }: MapCanvasProps) {
  const appKey = useKakaoMapKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KMap | null>(null);
  const libRef = useRef<KakaoMaps | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const programmaticRef = useRef(false);
  const [status, setStatus] = useState<Status>(appKey ? "loading" : "nokey");
  const [error, setError] = useState<string | null>(null);
  /** 사용자가 지도를 움직였을 때의 적용 범위. 범위가 바뀌면(뒤로 가기 등) 자연히 '움직이지 않음'이 된다 */
  const [movedAt, setMovedAt] = useState<string | null>(null);
  const bboxKey = appliedBbox?.join(",") ?? "";
  const bboxKeyRef = useRef(bboxKey);
  const moved = movedAt === bboxKey;
  const setMoved = (value: boolean) => setMovedAt(value ? bboxKeyRef.current : null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // 최신 props를 지도 이벤트 핸들러에서 읽기 위한 참조
  const latest = useRef({ items, selectedId, onSelect, onPickPlace, pickedIds, appliedBbox, insetLeft, insetRight });
  useEffect(() => {
    latest.current = { items, selectedId, onSelect, onPickPlace, pickedIds, appliedBbox, insetLeft, insetRight };
    bboxKeyRef.current = bboxKey;
  });

  function labelOf(g: Group): string {
    if (g.cluster) return `공고 ${g.ids.length}건이 모인 지역. 눌러서 확대`;
    if (g.ids.length > 1) return `같은 장소의 공고 ${g.ids.length}건${g.precision === "area" ? " · 대략 위치" : ""}`;
    const title = latest.current.items.find((a) => a.id === g.ids[0])?.title ?? "공고";
    return g.precision === "area" ? `${title} · 대략 위치` : title;
  }

  function syncMarkers() {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const { items: current, selectedId: sel, pickedIds: picked } = latest.current;
    const groups = groupForLevel(current, map.getLevel());
    const jobIds = new Set(current.filter((a) => a.category === "job").map((a) => a.id));
    const seen = new Set<string>();
    for (const g of groups) {
      seen.add(g.key);
      const selected = (sel !== null && g.ids.includes(sel)) || (!g.cluster && picked !== null && picked.length > 0 && g.ids.includes(picked[0]));
      let m = markersRef.current.get(g.key);
      if (!m) {
        const wrapper = document.createElement("div");
        const button = document.createElement("button");
        button.type = "button";
        wrapper.append(button);
        const overlay = new lib.CustomOverlay({ position: new lib.LatLng(g.lat, g.lng), content: wrapper, clickable: true, map });
        m = { overlay, button, group: g };
        markersRef.current.set(g.key, m);
        const key = g.key;
        button.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const marker = markersRef.current.get(key);
          if (marker) handleMarkerClick(marker.group);
        });
      }
      m.group = g;
      m.overlay.setZIndex(selected ? 5 : g.cluster ? 2 : 1);
      const label = labelOf(g);
      m.button.setAttribute("aria-label", label);
      m.button.title = label;
      m.button.dataset.markerId = g.key;
      m.button.dataset.precision = g.precision;
      const jobs = g.ids.filter((id) => jobIds.has(id)).length;
      m.button.dataset.kind = jobs === 0 ? "event" : jobs === g.ids.length ? "job" : "mixed";
      m.button.className = markerClass(g, selected);
      const color = markerColor(m.button.dataset.kind);
      m.button.style.background = selected ? "" : color;
      // 대략 위치(시·구)는 같은 색의 옅은 번짐으로 구분한다
      m.button.style.boxShadow =
        selected || g.precision !== "area" || g.cluster ? "" : `0 0 0 6px ${color}33, 0 2px 8px rgb(0 0 0 / 0.3)`;
      m.button.textContent = g.cluster || g.ids.length > 1 ? String(g.ids.length) : "";
      m.button.setAttribute("aria-pressed", String(selected));
    }
    for (const [key, m] of markersRef.current) {
      if (!seen.has(key)) {
        m.overlay.setMap(null);
        markersRef.current.delete(key);
      }
    }
  }

  function handleMarkerClick(g: Group) {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    if (g.cluster) {
      programmaticRef.current = true;
      setMoved(true);
      map.setLevel(Math.max(MIN_LEVEL, map.getLevel() - 2), { animate: true, anchor: new lib.LatLng(g.lat, g.lng) });
      return;
    }
    if (g.ids.length === 1) {
      latest.current.onSelect(g.ids[0]);
      return;
    }
    // 같은 장소의 여러 공고: 옆 목록을 그 장소의 공고로 좁힌다
    latest.current.onPickPlace(g.ids);
  }

  function fitTo(bbox: Bbox | null) {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const bounds = new lib.LatLngBounds();
    if (bbox) {
      bounds.extend(new lib.LatLng(bbox[1], bbox[0]));
      bounds.extend(new lib.LatLng(bbox[3], bbox[2]));
    } else {
      const points = latest.current.items.map(mapPointOf).filter((p): p is MapPoint => p !== null);
      if (points.length === 0) return;
      for (const p of points) bounds.extend(new lib.LatLng(p.lat, p.lng));
    }
    programmaticRef.current = true;
    const { insetLeft: left, insetRight: right } = latest.current;
    map.setBounds(bounds, 48, 48 + right, 48, 48 + left);
  }

  /* 지도 생성 */
  useEffect(() => {
    if (!appKey) return;
    let cancelled = false;
    const markers = markersRef.current;
    loadKakaoMaps(appKey)
      .then((lib) => {
        if (cancelled || !containerRef.current) return;
        libRef.current = lib;
        const map = new lib.Map(containerRef.current, { center: new lib.LatLng(37.5665, 126.978), level: 9 });
        map.setMinLevel(MIN_LEVEL);
        map.setMaxLevel(MAX_LEVEL);
        mapRef.current = map;
        lib.event.addListener(map, "dragend", () => setMoved(true));
        lib.event.addListener(map, "zoom_changed", () => {
          if (!programmaticRef.current) setMoved(true);
        });
        lib.event.addListener(map, "idle", () => {
          programmaticRef.current = false;
          syncMarkers();
        });
        fitTo(latest.current.appliedBbox);
        syncMarkers();
        setMoved(false);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      markers.forEach((m) => m.overlay.setMap(null));
      markers.clear();
      mapRef.current = null;
    };
    // attempt가 바뀌면 다시 시도한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, appKey]);

  /* 지도 영역 크기가 바뀌면(패널 열고 닫기 등) 다시 그린다 */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => mapRef.current?.relayout());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* 데이터·선택이 바뀌면 마커를 맞춘다 */
  const dataKey = items.map((a) => a.id).join("|");
  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, selectedId, status, pickedIds?.[0]]);

  /* 적용 범위가 바뀌면(뒤로 가기 등) 지도도 맞춘다 */
  useEffect(() => {
    if (status === "ready" && appliedBbox) fitTo(appliedBbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey]);

  /* 선택한 공고가 화면 밖이면 옮긴다 */
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || status !== "ready" || !selectedId) return;
    const a = items.find((x) => x.id === selectedId);
    const p = a ? mapPointOf(a) : null;
    if (!p) return;
    const pos = new lib.LatLng(p.lat, p.lng);
    if (!map.getBounds().contain(pos)) {
      programmaticRef.current = true;
      map.panTo(pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    setMoved(true);
    programmaticRef.current = true;
    map.setLevel(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, map.getLevel() - delta)), { animate: true });
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
        if (longitude < KOREA.minLng || longitude > KOREA.maxLng || latitude < KOREA.minLat || latitude > KOREA.maxLat) {
          setGeoMessage("현재 위치가 국내가 아니에요.");
          return;
        }
        const map = mapRef.current;
        const lib = libRef.current;
        if (!map || !lib) return;
        setMoved(true);
        programmaticRef.current = true;
        map.setLevel(6);
        map.panTo(new lib.LatLng(latitude, longitude));
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
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onSearchArea([sw.getLng(), sw.getLat(), ne.getLng(), ne.getLat()]);
    setMoved(false);
  };

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-[var(--map-bg)]" data-map-status={status}>
      <div ref={containerRef} className="h-full w-full" aria-label="공고 위치 지도. 모든 공고는 목록에서도 볼 수 있습니다." role="region" />

      <div
        style={{ left: insetLeft + 12 }}
        className="pointer-events-none absolute bottom-3 z-[2] hidden flex-wrap items-center gap-x-3 gap-y-1 rounded-full bg-panel/95 px-3 py-1.5 text-[11px] text-muted shadow-sm md:flex"
      >
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: EVENT_COLOR }} aria-hidden />
          행사·교육
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: JOB_COLOR }} aria-hidden />
          채용
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-[#5b6573] shadow-[0_0_0_3px_rgb(91_101_115/0.25)]" aria-hidden />
          번진 원 = 대략 위치(시·구)
        </span>
      </div>

      {moved && status === "ready" ? (
        <div className="absolute top-3 z-[3] -translate-x-1/2" style={{ left: `calc(${insetLeft}px + (100% - ${insetLeft + insetRight}px) / 2)` }}>
          <Button variant="primary" size="sm" onClick={searchHere} className="shadow-[var(--shadow)]">
            <ScanSearch className="size-4" aria-hidden />이 지역 다시 검색
          </Button>
        </div>
      ) : null}

      <div style={{ right: insetRight + 12 }} className="absolute top-3 z-[2] flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
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
        <div role="status" style={{ left: insetLeft + 12, right: insetRight + 12 }} className="absolute bottom-12 z-[2] rounded-md bg-panel px-3 py-2 text-[13px] shadow-[var(--shadow)]">
          {geoMessage}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[var(--map-bg)] text-[13px] text-muted" role="status">
          지도를 불러오는 중…
        </div>
      ) : null}

      {status === "error" || status === "nokey" ? (
        <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 bg-[var(--map-bg)] px-6 text-center" role="alert">
          <AlertTriangle className="size-6 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">{status === "nokey" ? "지도가 아직 설정되지 않았어요" : "지도를 불러오지 못했어요"}</p>
            <p className="mt-1 text-[13px] text-muted">목록은 그대로 사용할 수 있어요. 모든 공고를 목록에서 볼 수 있어요.</p>
            {status === "nokey" ? (
              <p className="mt-1 text-xs text-faint">(서버에 KAKAO_MAP_JS_KEY가 없어요)</p>
            ) : error ? (
              <p className="mt-1 text-xs text-faint">({error})</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {status === "error" ? (
              <Button
                onClick={() => {
                  setStatus("loading");
                  setError(null);
                  setAttempt((n) => n + 1);
                }}
              >
                <RefreshCw className="size-4" aria-hidden />
                다시 시도
              </Button>
            ) : null}
            <Button variant="primary" onClick={onShowList}>
              목록으로 보기
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const EVENT_COLOR = "#205d47";
const JOB_COLOR = "#3b5bdb";
const MIXED_COLOR = "#2b3440";

/** 채용은 파랑, 행사·교육은 초록, 섞인 묶음은 짙은 회색 */
function markerColor(kind: string | undefined): string {
  return kind === "job" ? JOB_COLOR : kind === "event" ? EVENT_COLOR : MIXED_COLOR;
}

/** 공고 수에 따라 원 크기를 키운다 */
function sizeFor(n: number): string {
  if (n >= 50) return "size-14 text-[15px]";
  if (n >= 10) return "size-11 text-sm";
  if (n > 1) return "size-9 text-[13px]";
  return "size-7 text-[11px]";
}

function markerClass(g: Group, selected: boolean): string {
  return cn(
    "flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold text-white shadow-[0_2px_8px_rgb(0_0_0/0.3)] transition-transform hover:scale-110 focus-visible:outline-2",
    sizeFor(g.ids.length),
    "border-[3px] border-white",
    g.cluster && "ring-4 ring-white/50",
    selected && "scale-110 bg-[#f59e0b] ring-4 ring-[#f59e0b]/35",
  );
}
