/** 공고 상세 주소. 목록·알림·캘린더 등 모든 화면이 이 경로로 상세를 연다 */
export function announcementHref(id: string): string {
  return `/announcements/${encodeURIComponent(id)}`;
}

const FROM_DISCOVER = "gonggoham:detail-from-discover";

/** 둘러보기에서 상세로 갔음을 기억한다. 상세의 ‘목록으로’가 브라우저 뒤로 가기를 써서 스크롤·필터를 그대로 되살린다 */
export function markOpenedFromDiscover() {
  try {
    sessionStorage.setItem(FROM_DISCOVER, "1");
  } catch {
    // 저장할 수 없으면 링크로 돌아간다
  }
}

export function consumeOpenedFromDiscover(): boolean {
  try {
    const v = sessionStorage.getItem(FROM_DISCOVER) === "1";
    sessionStorage.removeItem(FROM_DISCOVER);
    return v;
  } catch {
    return false;
  }
}
