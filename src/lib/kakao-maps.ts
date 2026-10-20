/**
 * 카카오맵 JavaScript SDK 로더와, 이 앱이 쓰는 범위의 최소 타입.
 * SDK는 키(도메인 제한)가 있어야 하므로 필요할 때 한 번만 불러온다.
 * https://apis.map.kakao.com/web/documentation/
 */
export interface KLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KLatLngBounds {
  extend(p: KLatLng): void;
  contain(p: KLatLng): boolean;
  getSouthWest(): KLatLng;
  getNorthEast(): KLatLng;
}

export interface KMap {
  setCenter(p: KLatLng): void;
  getCenter(): KLatLng;
  setLevel(level: number, options?: { animate?: boolean; anchor?: KLatLng }): void;
  getLevel(): number;
  setMinLevel(level: number): void;
  setMaxLevel(level: number): void;
  getBounds(): KLatLngBounds;
  setBounds(bounds: KLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
  panTo(p: KLatLng): void;
  relayout(): void;
}

export interface KCustomOverlay {
  setMap(map: KMap | null): void;
  setPosition(p: KLatLng): void;
  setContent(content: HTMLElement): void;
  setZIndex(z: number): void;
}

export interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new (sw?: KLatLng, ne?: KLatLng) => KLatLngBounds;
  Map: new (container: HTMLElement, options: { center: KLatLng; level: number }) => KMap;
  CustomOverlay: new (options: {
    position: KLatLng;
    content: HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
    map?: KMap;
  }) => KCustomOverlay;
  event: {
    addListener(target: KMap, type: "idle" | "dragend" | "zoom_changed" | "click" | "tilesloaded", handler: () => void): void;
  };
  load(callback: () => void): void;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const SDK_URL = "https://dapi.kakao.com/v2/maps/sdk.js";
let loading: Promise<KakaoMaps> | null = null;

export function loadKakaoMaps(appKey: string, timeoutMs = 10_000): Promise<KakaoMaps> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao.maps);
  if (loading) return loading;
  loading = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    const timer = window.setTimeout(() => fail(new Error("카카오맵을 불러오는 데 시간이 너무 오래 걸려요.")), timeoutMs);
    function fail(error: Error) {
      window.clearTimeout(timer);
      script.remove();
      loading = null; // 다시 시도할 수 있게 한다
      reject(error);
    }
    script.onerror = () => fail(new Error("카카오맵 스크립트를 불러오지 못했어요(키·등록 도메인·네트워크를 확인하세요)."));
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) return fail(new Error("카카오맵을 초기화하지 못했어요."));
      maps.load(() => {
        window.clearTimeout(timer);
        resolve(maps);
      });
    };
    document.head.append(script);
  });
  return loading;
}
