package dev.imjaewoo.gonggo.announcement;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * 공고에 알릴 변경이 생기면, 그 공고를 저장했거나 일정에 연결한 사용자에게 알림을 만든다.
 * 공고 저장과 같은 트랜잭션에서 쓰므로 변경이 저장되면 알림도 함께 남는다.
 * 같은 버전의 알림은 사용자당 한 번(dedupe_key = change:{공고}:v{버전}, 웹과 같은 규칙).
 */
@Component
class ChangeNotifier {

    private static final Map<String, String> TITLE = Map.of(
            "deadline", "마감일이 바뀌었어요",
            "venue", "장소가 바뀌었어요",
            "conditions", "조건·서류가 바뀌었어요",
            "cancel", "공고가 취소되었어요");
    /** 사용자 설정 열. kind는 정해진 네 값뿐이라 SQL에 그대로 넣어도 안전하다 */
    private static final Map<String, String> PREF_COLUMN = Map.of(
            "deadline", "alert_deadline",
            "venue", "alert_venue",
            "conditions", "alert_conditions",
            "cancel", "alert_cancel");

    private final JdbcClient jdbc;

    ChangeNotifier(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    void notify(Announcement a, int version, List<RevisionDetector.Change> changes, Instant now) {
        String dedupe = "change:" + a.getId() + ":v" + version;
        for (RevisionDetector.Change c : changes) {
            String title = "job".equals(a.getCategory()) && "cancel".equals(c.kind()) ? "채용이 마감되었어요" : TITLE.get(c.kind());
            jdbc.sql("""
                    insert into notifications (user_id, id, type, title, body, created_at, read, link_kind, link_id,
                                               dedupe_key, delivery)
                    select u.id, gen_random_uuid()::text, 'change', :title, :body, :now, false, 'announcement', :aid,
                           :dedupe, 'delivered'
                    from users u
                    where u.%s
                      and (exists (select 1 from saved_announcements s where s.user_id = u.id and s.announcement_id = :aid)
                        or exists (select 1 from calendar_events e where e.user_id = u.id and e.announcement_id = :aid))
                    on conflict do nothing""".formatted(PREF_COLUMN.get(c.kind())))
                    .param("title", title)
                    .param("body", a.getTitle() + " · " + c.before() + " → " + c.after())
                    .param("now", Timestamp.from(now))
                    .param("aid", a.getId())
                    .param("dedupe", dedupe)
                    .update();
        }
    }
}
