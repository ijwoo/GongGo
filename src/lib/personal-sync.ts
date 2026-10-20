import type { PersonalState } from "./personal-store";

/**
 * 개인 상태 변경(이전 → 다음)을 백엔드 API 호출 목록으로 바꾼다.
 * 화면은 지금처럼 순수 함수(personal-actions)로 다음 상태를 만들고, 저장소가 이 차이만 서버에 보낸다.
 * 자원 단위 PUT/DELETE라 같은 호출을 다시 보내도 결과가 같다.
 */
export interface SyncOp {
  method: "PUT" | "POST" | "DELETE";
  path: string;
  body?: unknown;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function seg(id: string): string {
  return encodeURIComponent(id);
}

function diffBy<T>(prev: T[], next: T[], key: (x: T) => string, path: (id: string) => string): SyncOp[] {
  const before = new Map(prev.map((x) => [key(x), x]));
  const after = new Map(next.map((x) => [key(x), x]));
  const ops: SyncOp[] = [];
  for (const [id, x] of after) {
    if (!same(before.get(id), x)) ops.push({ method: "PUT", path: path(id), body: x });
  }
  for (const id of before.keys()) {
    if (!after.has(id)) ops.push({ method: "DELETE", path: path(id) });
  }
  return ops;
}

export function diffPersonal(prev: PersonalState, next: PersonalState): SyncOp[] {
  const ops: SyncOp[] = [];
  if (!same(prev.profile, next.profile)) {
    ops.push(next.profile ? { method: "PUT", path: "/api/me/profile", body: next.profile } : { method: "DELETE", path: "/api/me/profile" });
  }
  if (!same(prev.changeAlerts, next.changeAlerts)) {
    ops.push({ method: "PUT", path: "/api/me/change-alerts", body: next.changeAlerts });
  }
  ops.push(...diffBy(prev.saved, next.saved, (x) => x.announcementId, (id) => `/api/me/saved/${seg(id)}`));
  ops.push(...diffBy(prev.events, next.events, (x) => x.id, (id) => `/api/me/events/${seg(id)}`));

  // 알림: '모두 읽음'처럼 여러 건이 읽음으로만 바뀌면 한 번에 보낸다
  const notificationOps = diffBy(prev.notifications, next.notifications, (x) => x.id, (id) => `/api/me/notifications/${seg(id)}`);
  const before = new Map(prev.notifications.map((n) => [n.id, n]));
  const onlyRead =
    notificationOps.length > 1 &&
    notificationOps.every((op) => {
      if (op.method !== "PUT") return false;
      const n = op.body as PersonalState["notifications"][number];
      const old = before.get(n.id);
      return old !== undefined && !old.read && n.read && same({ ...old, read: true }, n);
    });
  ops.push(...(onlyRead ? [{ method: "POST" as const, path: "/api/me/notifications/read-all" }] : notificationOps));

  ops.push(...diffBy(prev.applications, next.applications, (x) => x.announcementId, (id) => `/api/me/applications/${seg(id)}`));

  const sent = new Set(prev.sentReminderKeys);
  const added = next.sentReminderKeys.filter((k) => !sent.has(k));
  if (added.length) ops.push({ method: "POST", path: "/api/me/sent-reminders", body: { keys: added } });
  return ops;
}
