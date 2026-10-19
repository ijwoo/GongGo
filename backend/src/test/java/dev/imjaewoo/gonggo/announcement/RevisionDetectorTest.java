package dev.imjaewoo.gonggo.announcement;

import static org.assertj.core.api.Assertions.assertThat;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.node.JsonNodeFactory;

class RevisionDetectorTest {

    private static final Venue SEONGSU = new Venue.Confirmed("성수 데모라운지", "서울 성동구 (예시 주소)", "성수",
            new Venue.Coordinates(37.5445, 127.0557));

    @Test
    void 장소_변경은_웹과_같은_형식으로_적는다() {
        var before = base(SEONGSU, List.of("신청서"), "active");
        var after = base(new Venue.Tbd("추후 공지"), List.of("신청서"), "active");

        assertThat(RevisionDetector.detect(before, after)).singleElement().satisfies(c -> {
            assertThat(c.kind()).isEqualTo("venue");
            assertThat(c.before()).isEqualTo("성수 데모라운지 · 서울 성동구 (예시 주소)");
            assertThat(c.after()).isEqualTo("장소 미정 (추후 공지)");
        });
    }

    @Test
    void 서류_추가와_취소를_각각_남긴다() {
        var before = base(SEONGSU, List.of("신청서"), "active");
        var after = base(SEONGSU, List.of("신청서", "추천서"), "cancelled");

        assertThat(RevisionDetector.detect(before, after))
                .extracting(RevisionDetector.Change::kind)
                .containsExactly("conditions", "cancel");
    }

    @Test
    void 같은_내용이면_변경이_없다() {
        assertThat(RevisionDetector.detect(base(SEONGSU, List.of(), "active"), base(SEONGSU, List.of(), "active")))
                .isEmpty();
    }

    @Test
    void 날짜_표기는_서울_기준이다() {
        // 2026-10-31T15:30Z = 서울 11월 1일(일) 00:30
        assertThat(new Deadline.AtTime(Instant.parse("2026-10-31T15:30:00Z")).format()).isEqualTo("11월 1일 (일) 00:30");
        assertThat(new Deadline.OnDate(LocalDate.of(2026, 10, 30)).format()).isEqualTo("10월 30일 (금) · 시각 미공지");
    }

    private static AnnouncementContent base(Venue venue, List<String> docs, String status) {
        return new AnnouncementContent("x", "공고", new Organizer("기관", null, "#000000"), "event", "demo",
                "https://example.com", "출처", Instant.EPOCH, Instant.EPOCH, new ApplicationStart.Tbd(),
                new Deadline.Rolling(), new EventSchedule.Tbd(), "offline", venue, List.of(), null, null, null,
                JsonNodeFactory.instance.arrayNode(), docs, List.of(), status);
    }
}
