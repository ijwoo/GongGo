import { describe, expect, it } from "vitest";
import { addEvent, deleteEvent, markAllNotificationsRead, markNotificationRead, toggleSaved, upsertApplication } from "@/lib/personal-actions";
import { EMPTY_STATE, stateFromMe, type PersonalState } from "@/lib/personal-store";
import { diffPersonal } from "@/lib/personal-sync";
import type { AppNotification } from "@/domain/types";
import { NOW, byId, testId } from "./fixtures";

const base: PersonalState = { ...EMPTY_STATE, session: { userId: "1", displayName: "민지" } };

function note(id: string, read = false): AppNotification {
  return { id, type: "reminder", title: "t", body: "b", createdAt: NOW, read, link: null, dedupeKey: `k-${id}`, delivery: "delivered" };
}

describe("개인 상태 변경 → 서버 호출", () => {
  it("관심 저장·해제는 자원 단위 PUT/DELETE", () => {
    const a = byId("hk-pangyo-ai");
    const saved = toggleSaved(base, a, NOW);
    expect(diffPersonal(base, saved)).toEqual([
      { method: "PUT", path: "/api/me/saved/hk-pangyo-ai", body: { announcementId: "hk-pangyo-ai", savedAt: NOW, seenVersion: a.contentVersion } },
    ]);
    expect(diffPersonal(saved, toggleSaved(saved, a, NOW))).toEqual([{ method: "DELETE", path: "/api/me/saved/hk-pangyo-ai" }]);
  });

  it("바뀌지 않은 상태는 아무것도 보내지 않는다", () => {
    expect(diffPersonal(base, { ...base })).toEqual([]);
  });

  it("일정 추가·삭제, 지원 현황 갱신", () => {
    const a = byId("hk-pangyo-ai");
    const r = addEvent(
      base,
      { announcement: a, kind: "prep", title: "준비", timing: { type: "allDay", start: "2026-10-22", end: "2026-10-22", timeUnknown: false }, reminders: [], memo: "" },
      NOW,
      testId,
    );
    if (!r.ok) throw new Error();
    expect(diffPersonal(base, r.state)).toEqual([{ method: "PUT", path: `/api/me/events/${r.event.id}`, body: r.event }]);
    expect(diffPersonal(r.state, deleteEvent(r.state, r.event.id))).toEqual([{ method: "DELETE", path: `/api/me/events/${r.event.id}` }]);

    const applied = upsertApplication(base, a, { status: "preparing" }, NOW, testId);
    expect(diffPersonal(base, applied)[0]).toMatchObject({ method: "PUT", path: "/api/me/applications/hk-pangyo-ai" });
  });

  it("여러 알림을 읽음으로만 바꾸면 한 번에 보내고, 하나면 그 알림만 보낸다", () => {
    const s = { ...base, notifications: [note("a"), note("b"), note("c", true)] };
    expect(diffPersonal(s, markAllNotificationsRead(s))).toEqual([{ method: "POST", path: "/api/me/notifications/read-all" }]);
    expect(diffPersonal(s, markNotificationRead(s, "a"))).toEqual([{ method: "PUT", path: "/api/me/notifications/a", body: note("a", true) }]);
  });

  it("새로 보낸 예약 알림 키만 보낸다", () => {
    const s = { ...base, sentReminderKeys: ["k1"] };
    expect(diffPersonal(s, { ...s, sentReminderKeys: ["k1", "k2", "k3"] })).toEqual([
      { method: "POST", path: "/api/me/sent-reminders", body: { keys: ["k2", "k3"] } },
    ]);
  });

  it("프로필을 지우면 DELETE, 알림 설정은 PUT", () => {
    const withProfile = { ...base, profile: { interests: [], region: null, career: null, teamSize: null, startupYears: null } };
    expect(diffPersonal(withProfile, base)).toEqual([{ method: "DELETE", path: "/api/me/profile" }]);
    const alerts = { ...base, changeAlerts: { ...base.changeAlerts, venue: false } };
    expect(diffPersonal(base, alerts)).toEqual([{ method: "PUT", path: "/api/me/change-alerts", body: alerts.changeAlerts }]);
  });

  it("경로의 id는 인코딩한다", () => {
    const s = { ...base, saved: [{ announcementId: "a/b c", savedAt: NOW, seenVersion: 1 }] };
    expect(diffPersonal(s, base)[0].path).toBe("/api/me/saved/a%2Fb%20c");
  });
});

describe("서버 응답 → 화면 상태", () => {
  it("닉네임이 없으면 '카카오 사용자'로 보여 준다", () => {
    const s = stateFromMe({
      user: { id: 7, nickname: null },
      profile: null,
      saved: [],
      events: [],
      notifications: [],
      applications: [],
      changeAlerts: EMPTY_STATE.changeAlerts,
      sentReminderKeys: [],
    });
    expect(s.session).toEqual({ userId: "7", displayName: "카카오 사용자" });
  });
});
