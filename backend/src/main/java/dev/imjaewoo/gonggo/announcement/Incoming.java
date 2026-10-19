package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementRevisionView;
import java.time.Instant;
import java.util.List;

/**
 * 출처에서 정규화해 들어온 공고 한 건.
 * initialVersion·history는 처음 넣을 때만 쓴다(데모 시드에 이미 있는 변경 이력). 수집 공고는 1과 빈 목록.
 */
public record Incoming(
        String externalId,
        AnnouncementContent content,
        Instant checkedAt,
        int initialVersion,
        List<AnnouncementRevisionView> history) {

    public static Incoming fresh(String externalId, AnnouncementContent content, Instant checkedAt) {
        return new Incoming(externalId, content, checkedAt, 1, List.of());
    }
}
