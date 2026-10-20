package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementImage;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** 공고 대표 이미지 표(announcement_images). 찾지 못한 결과(url null)도 남겨 같은 페이지를 매번 열지 않는다 */
@Component
public class AnnouncementImageStore {

    /** 이미지를 찾을 공고. organizerName은 출처별 대체 주소(회사 홈페이지)를 고를 때 쓴다 */
    public record Pending(String announcementId, String sourceUrl, String organizerName) {
    }

    private final JdbcClient jdbc;

    public AnnouncementImageStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, AnnouncementImage> find(List<String> announcementIds) {
        Map<String, AnnouncementImage> out = new HashMap<>();
        if (announcementIds.isEmpty()) {
            return out;
        }
        jdbc.sql("select announcement_id, url, kind from announcement_images where url is not null and announcement_id in (:ids)")
                .param("ids", announcementIds)
                .query((rs, i) -> out.put(rs.getString("announcement_id"),
                        new AnnouncementImage(rs.getString("url"), rs.getString("kind"), null)))
                .list();
        return out;
    }

    /** 아직 찾아보지 않았거나, 못 찾은 지 retryAfter가 지난 열린 공고 */
    public List<Pending> pending(String sourceId, Instant retryBefore, int limit) {
        return jdbc.sql("""
                select a.id, a.source_url, a.organizer_name
                from announcements a left join announcement_images i on i.announcement_id = a.id
                where a.source_id = ? and a.status = 'active'
                  and (i.announcement_id is null or (i.url is null and i.checked_at < ?))
                order by a.published_at desc
                limit ?""")
                .params(sourceId, Timestamp.from(retryBefore), limit)
                .query((rs, i) -> new Pending(rs.getString("id"), rs.getString("source_url"),
                        rs.getString("organizer_name")))
                .list();
    }

    public void save(String announcementId, AnnouncementImage image, Instant checkedAt) {
        jdbc.sql("""
                insert into announcement_images (announcement_id, url, kind, checked_at) values (?, ?, ?, ?)
                on conflict (announcement_id) do update
                    set url = excluded.url, kind = excluded.kind, checked_at = excluded.checked_at""")
                .params(announcementId, image != null ? image.url() : null, image != null ? image.kind() : null,
                        Timestamp.from(checkedAt))
                .update();
    }
}
