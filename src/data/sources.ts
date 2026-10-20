/**
 * 공고 수집 출처별 이용 정책.
 * 실제 출처를 붙일 때는 각 출처의 이용약관·robots 정책·허락 범위를 확인한 뒤 여기에 기록한다.
 * 화면은 이 설정을 보고 출처 표시 문구와 가공 여부를 결정한다.
 */
export type SourceUse = "link" | "summary" | "fullText";

export interface SourcePolicy {
  id: string;
  name: string;
  /** 허용된 이용 방식. link만 있으면 제목·링크만 보여 줄 수 있다 */
  allowedUses: SourceUse[];
  /** 화면에 반드시 붙여야 하는 출처 표시 문구 */
  attribution: string;
  /** 조건 구조화·요약 같은 가공 허용 여부 */
  allowTransform: boolean;
  /** 이용 허락을 확인한 근거(계약서, 약관 링크 등) */
  permissionNote: string;
}

/** 백엔드 sources 표(V1·V2 마이그레이션)와 같은 내용 */
export const SOURCE_POLICIES: Record<string, SourcePolicy> = {
  devevent: {
    id: "devevent",
    name: "Dev-Event",
    allowedUses: ["link"],
    attribution: "출처: Dev-Event (github.com/brave-people/Dev-Event). 행사명·일정·주최·링크만 표시하며, 자세한 내용은 원문에서 확인하세요.",
    allowTransform: true,
    permissionNote: "커뮤니티가 관리하는 공개 목록. 라이선스 표기가 없어 최소 정보와 원문 링크만 쓴다.",
  },
  greenhouse: {
    id: "greenhouse",
    name: "Greenhouse 채용 공고",
    allowedUses: ["link"],
    attribution: "출처: 각 회사 Greenhouse 채용 페이지. 지원은 원문에서 하세요.",
    allowTransform: true,
    permissionNote: "회사가 공개한 Greenhouse Job Board API.",
  },
  kstartup: {
    id: "kstartup",
    name: "K-Startup 사업공고",
    allowedUses: ["link", "summary"],
    attribution: "출처: 창업진흥원 K-Startup, 공공데이터포털",
    allowTransform: true,
    permissionNote: "공공데이터포털 오픈 API. 이용허락범위는 데이터셋 페이지 표시를 따른다.",
  },
};

export function sourcePolicy(sourceId: string): SourcePolicy | null {
  return SOURCE_POLICIES[sourceId] ?? null;
}
