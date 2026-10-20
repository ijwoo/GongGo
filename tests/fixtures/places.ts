import type { Coordinates } from "@/domain/types";

/**
 * 데모용 장소. 이름은 모두 가상이며, 좌표는 해당 행정구역의 대략적인 위치다.
 * 실제 건물·기관을 가리키지 않는다.
 */
export interface DemoPlace {
  name: string;
  address: string;
  district: string;
  coordinates: Coordinates;
}

export const PLACES = {
  pangyo: { name: "판교 데모홀", address: "경기 성남시 분당구 (예시 주소)", district: "성남 판교", coordinates: { lat: 37.4022, lng: 127.1087 } },
  seongsu: { name: "성수 실험공간 3층", address: "서울 성동구 (예시 주소)", district: "서울 성동", coordinates: { lat: 37.5446, lng: 127.0557 } },
  gangnam: { name: "역삼 라운지 B", address: "서울 강남구 (예시 주소)", district: "서울 강남", coordinates: { lat: 37.5006, lng: 127.0366 } },
  sangam: { name: "상암 미디어 데모센터", address: "서울 마포구 (예시 주소)", district: "서울 마포", coordinates: { lat: 37.5793, lng: 126.8894 } },
  hongdae: { name: "홍대 코워킹 예시점", address: "서울 마포구 (예시 주소)", district: "서울 마포", coordinates: { lat: 37.5565, lng: 126.9226 } },
  yeouido: { name: "여의도 컨퍼런스룸 7", address: "서울 영등포구 (예시 주소)", district: "서울 영등포", coordinates: { lat: 37.5218, lng: 126.9243 } },
  guro: { name: "구로 디지털 교육장", address: "서울 구로구 (예시 주소)", district: "서울 구로", coordinates: { lat: 37.4851, lng: 126.9013 } },
  jongno: { name: "종로 오픈 스튜디오", address: "서울 종로구 (예시 주소)", district: "서울 종로", coordinates: { lat: 37.5716, lng: 126.9769 } },
  euljiro: { name: "을지로 메이커스 공간", address: "서울 중구 (예시 주소)", district: "서울 중구", coordinates: { lat: 37.5661, lng: 126.9912 } },
  yangjae: { name: "양재 AI 실습실", address: "서울 서초구 (예시 주소)", district: "서울 서초", coordinates: { lat: 37.4842, lng: 127.0348 } },
  magok: { name: "마곡 연구동 세미나실", address: "서울 강서구 (예시 주소)", district: "서울 강서", coordinates: { lat: 37.5601, lng: 126.8256 } },
  munjeong: { name: "문정 벤처 홀", address: "서울 송파구 (예시 주소)", district: "서울 송파", coordinates: { lat: 37.4857, lng: 127.1224 } },
  gwanak: { name: "관악 청년 창업방", address: "서울 관악구 (예시 주소)", district: "서울 관악", coordinates: { lat: 37.4813, lng: 126.9526 } },
  gwanggyo: { name: "광교 테크 라운지", address: "경기 수원시 영통구 (예시 주소)", district: "수원 광교", coordinates: { lat: 37.2885, lng: 127.0512 } },
  ilsan: { name: "일산 전시장 2홀", address: "경기 고양시 일산서구 (예시 주소)", district: "고양 일산", coordinates: { lat: 37.6689, lng: 126.7452 } },
  pyeongchon: { name: "평촌 스마트 교육관", address: "경기 안양시 동안구 (예시 주소)", district: "안양 평촌", coordinates: { lat: 37.3898, lng: 126.9508 } },
  dongtan: { name: "동탄 창업 허브", address: "경기 화성시 (예시 주소)", district: "화성 동탄", coordinates: { lat: 37.2006, lng: 127.0731 } },
  bucheon: { name: "부천 콘텐츠 실습실", address: "경기 부천시 (예시 주소)", district: "경기 부천", coordinates: { lat: 37.5036, lng: 126.7661 } },
  gwacheon: { name: "과천 과학 세미나홀", address: "경기 과천시 (예시 주소)", district: "경기 과천", coordinates: { lat: 37.4293, lng: 126.9877 } },
  hanam: { name: "미사 커뮤니티 랩", address: "경기 하남시 (예시 주소)", district: "경기 하남", coordinates: { lat: 37.5627, lng: 127.1926 } },
} satisfies Record<string, DemoPlace>;

/** 예시 지도에 표시하는 지역 이름 표식(대략적인 위치) */
export const AREA_LABELS: { name: string; coordinates: Coordinates }[] = [
  { name: "서울 도심", coordinates: { lat: 37.566, lng: 126.978 } },
  { name: "강남", coordinates: { lat: 37.497, lng: 127.028 } },
  { name: "마포", coordinates: { lat: 37.563, lng: 126.908 } },
  { name: "영등포", coordinates: { lat: 37.526, lng: 126.896 } },
  { name: "송파", coordinates: { lat: 37.514, lng: 127.106 } },
  { name: "성남", coordinates: { lat: 37.42, lng: 127.127 } },
  { name: "수원", coordinates: { lat: 37.263, lng: 127.029 } },
  { name: "고양", coordinates: { lat: 37.658, lng: 126.832 } },
  { name: "안양", coordinates: { lat: 37.394, lng: 126.957 } },
  { name: "부천", coordinates: { lat: 37.503, lng: 126.766 } },
  { name: "화성", coordinates: { lat: 37.2, lng: 126.95 } },
  { name: "하남", coordinates: { lat: 37.539, lng: 127.215 } },
  { name: "의정부", coordinates: { lat: 37.738, lng: 127.034 } },
];
