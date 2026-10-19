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

export const SOURCE_POLICIES: Record<string, SourcePolicy> = {
  demo: {
    id: "demo",
    name: "데모 공고 게시판",
    allowedUses: ["link", "summary", "fullText"],
    attribution: "공고·기관·장소는 데모용 예시입니다.",
    allowTransform: true,
    permissionNote: "직접 만든 합성 데이터",
  },
};

export function sourcePolicy(sourceId: string): SourcePolicy | null {
  return SOURCE_POLICIES[sourceId] ?? null;
}
