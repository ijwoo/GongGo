package dev.imjaewoo.gonggo.me;

import dev.imjaewoo.gonggo.me.MeDtos.Application;
import dev.imjaewoo.gonggo.me.MeDtos.CalendarEvent;
import dev.imjaewoo.gonggo.me.MeDtos.ChangeAlerts;
import dev.imjaewoo.gonggo.me.MeDtos.ChecklistItem;
import dev.imjaewoo.gonggo.me.MeDtos.Link;
import dev.imjaewoo.gonggo.me.MeDtos.Notification;
import dev.imjaewoo.gonggo.me.MeDtos.Offset;
import dev.imjaewoo.gonggo.me.MeDtos.Profile;
import dev.imjaewoo.gonggo.me.MeDtos.Reminder;
import dev.imjaewoo.gonggo.me.MeDtos.Saved;
import dev.imjaewoo.gonggo.me.MeDtos.Timing;
import dev.imjaewoo.gonggo.me.MeDtos.UserView;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * 개인 데이터 저장. 모든 쿼리는 세션의 user_id로 범위를 묶는다(경로의 id만으로는 남의 행에 닿지 않는다).
 * 쓰기는 자원 단위 PUT(있으면 바꾸고 없으면 만든다)이라 같은 요청을 다시 보내도 결과가 같다.
 */
@Service
@Transactional
public class PersonalDataService {

    static final int NOTIFICATION_LIMIT = 200;
    static final int SENT_KEY_LIMIT = 1000;
    static final int EVENT_LIMIT = 1000;

    private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {
    };
    private static final TypeReference<List<ChecklistItem>> CHECKLIST = new TypeReference<>() {
    };

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public PersonalDataService(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /* ───────── 전체 읽기 ───────── */

    @Transactional(readOnly = true)
    public MeDtos.Me load(UserView user) {
        long uid = user.id();
        return new MeDtos.Me(user, profile(uid).orElse(null), saved(uid), events(uid), notifications(uid),
                applications(uid), changeAlerts(uid), sentKeys(uid));
    }

    /* ───────── 프로필·알림 설정 ───────── */

    Optional<Profile> profile(long uid) {
        return jdbc.sql("select * from user_profiles where user_id = ?").param(uid)
                .query((rs, i) -> new Profile(json.readValue(rs.getString("interests"), STRINGS),
                        rs.getString("region"), rs.getString("career"), intOrNull(rs, "team_size"),
                        intOrNull(rs, "startup_years")))
                .optional();
    }

    public void putProfile(long uid, Profile p) {
        jdbc.sql("""
                insert into user_profiles (user_id, interests, region, career, team_size, startup_years, updated_at)
                values (?, ?::jsonb, ?, ?, ?, ?, now())
                on conflict (user_id) do update set interests = excluded.interests, region = excluded.region,
                    career = excluded.career, team_size = excluded.team_size,
                    startup_years = excluded.startup_years, updated_at = now()""")
                .params(uid, json.writeValueAsString(p.interests().stream().distinct().toList()), p.region(),
                        p.career(), p.teamSize(), p.startupYears())
                .update();
    }

    public void deleteProfile(long uid) {
        jdbc.sql("delete from user_profiles where user_id = ?").param(uid).update();
    }

    ChangeAlerts changeAlerts(long uid) {
        return jdbc.sql("select alert_deadline, alert_venue, alert_conditions, alert_cancel from users where id = ?")
                .param(uid)
                .query((rs, i) -> new ChangeAlerts(rs.getBoolean(1), rs.getBoolean(2), rs.getBoolean(3),
                        rs.getBoolean(4)))
                .single();
    }

    public void putChangeAlerts(long uid, ChangeAlerts a) {
        jdbc.sql("""
                update users set alert_deadline = ?, alert_venue = ?, alert_conditions = ?, alert_cancel = ?
                where id = ?""")
                .params(a.deadline(), a.venue(), a.conditions(), a.cancel(), uid).update();
    }

    /* ───────── 관심 공고 ───────── */

    List<Saved> saved(long uid) {
        return jdbc.sql("""
                select announcement_id, saved_at, seen_version from saved_announcements
                where user_id = ? order by saved_at""").param(uid)
                .query((rs, i) -> new Saved(rs.getString(1), instant(rs, "saved_at"), rs.getInt(3)))
                .list();
    }

    public void putSaved(long uid, String announcementId, Saved s) {
        sameId(announcementId, s.announcementId());
        try {
            jdbc.sql("""
                    insert into saved_announcements (user_id, announcement_id, saved_at, seen_version)
                    values (?, ?, ?, ?)
                    on conflict (user_id, announcement_id) do update set seen_version = excluded.seen_version""")
                    .params(uid, announcementId, ts(s.savedAt()), s.seenVersion()).update();
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고를 찾을 수 없습니다.");
        }
    }

    public void deleteSaved(long uid, String announcementId) {
        jdbc.sql("delete from saved_announcements where user_id = ? and announcement_id = ?")
                .params(uid, announcementId).update();
    }

    /* ───────── 캘린더 ───────── */

    List<CalendarEvent> events(long uid) {
        Map<String, List<Reminder>> reminders = new LinkedHashMap<>();
        jdbc.sql("""
                select event_id, id, offset_type, offset_days, offset_time, channel from event_reminders
                where user_id = ? order by event_id, position""").param(uid)
                .query(rs -> {
                    Offset offset = "preset".equals(rs.getString("offset_type"))
                            ? new Offset.Preset(rs.getInt("offset_days"))
                            : new Offset.Custom(rs.getInt("offset_days"), rs.getString("offset_time"));
                    reminders.computeIfAbsent(rs.getString("event_id"), k -> new ArrayList<>())
                            .add(new Reminder(rs.getString("id"), offset, rs.getString("channel")));
                });
        return jdbc.sql("select * from calendar_events where user_id = ? order by created_at, id").param(uid)
                .query((rs, i) -> {
                    String id = rs.getString("id");
                    Timing timing = "allDay".equals(rs.getString("timing_type"))
                            ? new Timing.AllDay(date(rs, "start_date"), date(rs, "end_date"), rs.getBoolean("time_unknown"))
                            : new Timing.Timed(instant(rs, "start_at"), instant(rs, "end_at"));
                    return new CalendarEvent(id, rs.getString("announcement_id"), rs.getString("kind"),
                            rs.getString("title"), timing, intOrNull(rs, "source_version"),
                            reminders.getOrDefault(id, List.of()), rs.getString("memo"), instant(rs, "created_at"),
                            instant(rs, "updated_at"));
                })
                .list();
    }

    public void putEvent(long uid, String id, CalendarEvent e) {
        sameId(id, e.id());
        long count = jdbc.sql("select count(*) from calendar_events where user_id = ?").param(uid)
                .query(Long.class).single();
        if (count >= EVENT_LIMIT) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, "일정은 " + EVENT_LIMIT + "개까지 저장할 수 있어요.");
        }
        LocalDate startDate = null;
        LocalDate endDate = null;
        Boolean timeUnknown = null;
        Instant startAt = null;
        Instant endAt = null;
        switch (e.timing()) {
            case Timing.AllDay d -> {
                if (d.end().isBefore(d.start())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종료일이 시작일보다 앞설 수 없습니다.");
                }
                startDate = d.start();
                endDate = d.end();
                timeUnknown = d.timeUnknown();
            }
            case Timing.Timed t -> {
                startAt = t.start();
                endAt = t.end();
            }
        }
        try {
            jdbc.sql("""
                    insert into calendar_events (user_id, id, announcement_id, kind, title, timing_type, start_date,
                        end_date, time_unknown, start_at, end_at, source_version, memo, created_at, updated_at)
                    values (:uid, :id, :aid, :kind, :title, :tt, :sd, :ed, :tu, :sa, :ea, :sv, :memo, :ca, :ua)
                    on conflict (user_id, id) do update set announcement_id = excluded.announcement_id,
                        kind = excluded.kind, title = excluded.title, timing_type = excluded.timing_type,
                        start_date = excluded.start_date, end_date = excluded.end_date,
                        time_unknown = excluded.time_unknown, start_at = excluded.start_at, end_at = excluded.end_at,
                        source_version = excluded.source_version, memo = excluded.memo,
                        updated_at = excluded.updated_at""")
                    .param("uid", uid).param("id", id).param("aid", e.announcementId()).param("kind", e.kind())
                    .param("title", e.title()).param("tt", e.timing() instanceof Timing.AllDay ? "allDay" : "timed")
                    .param("sd", startDate == null ? null : Date.valueOf(startDate))
                    .param("ed", endDate == null ? null : Date.valueOf(endDate))
                    .param("tu", timeUnknown).param("sa", ts(startAt)).param("ea", ts(endAt))
                    .param("sv", e.sourceVersion()).param("memo", e.memo()).param("ca", ts(e.createdAt()))
                    .param("ua", ts(e.updatedAt()))
                    .update();
        } catch (DuplicateKeyException ex) {
            // 같은 공고의 같은 종류(마감·행사) 일정이 이미 있다
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 같은 종류의 일정이 등록되어 있어요.");
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고를 찾을 수 없습니다.");
        }
        jdbc.sql("delete from event_reminders where user_id = ? and event_id = ?").params(uid, id).update();
        int position = 0;
        for (Reminder r : e.reminders()) {
            jdbc.sql("""
                    insert into event_reminders (user_id, event_id, id, offset_type, offset_days, offset_time, channel,
                        position) values (?, ?, ?, ?, ?, ?, ?, ?)
                    on conflict do nothing""")
                    .params(uid, id, r.id(), r.offset() instanceof Offset.Preset ? "preset" : "custom",
                            r.offset().days(), r.offset() instanceof Offset.Custom c ? c.time() : null, r.channel(),
                            position++)
                    .update();
        }
    }

    public void deleteEvent(long uid, String id) {
        jdbc.sql("delete from calendar_events where user_id = ? and id = ?").params(uid, id).update();
    }

    /* ───────── 알림 ───────── */

    List<Notification> notifications(long uid) {
        return jdbc.sql("""
                select * from notifications where user_id = ? order by created_at desc, id limit ?""")
                .params(uid, NOTIFICATION_LIMIT)
                .query((rs, i) -> new Notification(rs.getString("id"), rs.getString("type"), rs.getString("title"),
                        rs.getString("body"), instant(rs, "created_at"), rs.getBoolean("read"),
                        rs.getString("link_kind") == null ? null
                                : new Link(rs.getString("link_kind"), rs.getString("link_id")),
                        rs.getString("dedupe_key"), rs.getString("delivery"), rs.getString("failure_reason")))
                .list();
    }

    /** 있으면 읽음 여부만 바꾸고, 없으면 만든다. 같은 dedupe_key의 알림이 이미 있으면 새로 만들지 않는다 */
    public void putNotification(long uid, String id, Notification n) {
        sameId(id, n.id());
        int updated = jdbc.sql("update notifications set read = ? where user_id = ? and id = ?")
                .params(n.read(), uid, id).update();
        if (updated > 0) {
            return;
        }
        jdbc.sql("""
                insert into notifications (user_id, id, type, title, body, created_at, read, link_kind, link_id,
                    dedupe_key, delivery, failure_reason)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict do nothing""")
                .params(uid, id, n.type(), n.title(), n.body(), ts(n.createdAt()), n.read(),
                        n.link() == null ? null : n.link().kind(), n.link() == null ? null : n.link().id(),
                        n.dedupeKey(), n.delivery(), n.failureReason())
                .update();
        // 오래된 알림은 지운다(화면도 최근 200개만 보여 준다)
        jdbc.sql("""
                delete from notifications where user_id = :uid and id not in (
                    select id from notifications where user_id = :uid order by created_at desc, id limit :limit)""")
                .param("uid", uid).param("limit", NOTIFICATION_LIMIT).update();
    }

    public void readAllNotifications(long uid) {
        jdbc.sql("update notifications set read = true where user_id = ? and not read").param(uid).update();
    }

    /* ───────── 지원 현황 ───────── */

    List<Application> applications(long uid) {
        return jdbc.sql("select * from application_records where user_id = ? order by updated_at").param(uid)
                .query((rs, i) -> new Application(rs.getString("announcement_id"), rs.getString("status"),
                        rs.getString("memo"), json.readValue(rs.getString("checklist"), CHECKLIST),
                        instant(rs, "updated_at")))
                .list();
    }

    public void putApplication(long uid, String announcementId, Application a) {
        sameId(announcementId, a.announcementId());
        try {
            jdbc.sql("""
                    insert into application_records (user_id, announcement_id, status, memo, checklist, updated_at)
                    values (?, ?, ?, ?, ?::jsonb, ?)
                    on conflict (user_id, announcement_id) do update set status = excluded.status,
                        memo = excluded.memo, checklist = excluded.checklist, updated_at = excluded.updated_at""")
                    .params(uid, announcementId, a.status(), a.memo(), json.writeValueAsString(a.checklist()),
                            ts(a.updatedAt()))
                    .update();
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고를 찾을 수 없습니다.");
        }
    }

    public void deleteApplication(long uid, String announcementId) {
        jdbc.sql("delete from application_records where user_id = ? and announcement_id = ?")
                .params(uid, announcementId).update();
    }

    /* ───────── 보낸 예약 알림 키 ───────── */

    List<String> sentKeys(long uid) {
        return jdbc.sql("select key from sent_reminder_keys where user_id = ? order by sent_at, key").param(uid)
                .query(String.class).list();
    }

    public void addSentKeys(long uid, List<String> keys) {
        for (String key : keys) {
            jdbc.sql("insert into sent_reminder_keys (user_id, key) values (?, ?) on conflict do nothing")
                    .params(uid, key).update();
        }
        jdbc.sql("""
                delete from sent_reminder_keys where user_id = :uid and key not in (
                    select key from sent_reminder_keys where user_id = :uid order by sent_at desc, key limit :limit)""")
                .param("uid", uid).param("limit", SENT_KEY_LIMIT).update();
    }

    /* ───────── 공통 ───────── */

    private static void sameId(String pathId, String bodyId) {
        if (!pathId.equals(bodyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "경로와 본문의 id가 다릅니다.");
        }
    }

    private static Timestamp ts(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    private static LocalDate date(ResultSet rs, String col) throws SQLException {
        Date d = rs.getDate(col);
        return d == null ? null : d.toLocalDate();
    }

    private static Integer intOrNull(ResultSet rs, String col) throws SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }
}
