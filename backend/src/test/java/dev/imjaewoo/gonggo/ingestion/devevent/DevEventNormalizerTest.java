package dev.imjaewoo.gonggo.ingestion.devevent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.json.JsonMapper;

/** 픽스처는 실제 README에서 형식별로 한 건씩 골라 줄인 것이다(연도 넘김 사례만 만든 것) */
class DevEventNormalizerTest {

    private static final Instant NOW = Instant.parse("2026-10-19T01:00:00Z");
    private final JsonMapper json = JsonMapper.builder().build();
    private final DevEventNormalizer normalizer = new DevEventNormalizer(json);
    private List<SourceRecord> records;

    @BeforeEach
    void setUp() throws Exception {
        try (InputStream in = new ClassPathResource("devevent/README.md").getInputStream()) {
            records = new DevEventParser(json).parse(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private AnnouncementContent content(int i) {
        return normalizer.normalize(records.get(i), NOW).content();
    }

    @Test
    void 월_절_안의_행사만_읽고_주석과_다른_절은_건너뛴다() {
        assertThat(records).extracting(r -> r.payload().path("title").asString()).containsExactly(
                "합성 미세구조 기반 재료 물성 예측 AI 경진대회",
                "[무료 웨비나] AI 코딩 시대, 코드 품질 관리",
                "OpenAI DevDay Exchange 2026 - 서울",
                "겨울 백엔드 부트캠프");
    }

    @Test
    void 시각이_있는_접수_기간은_서울_시각으로_저장한다() {
        var c = content(0);
        assertThat(c.category()).isEqualTo("hackathon");
        assertThat(c.applicationStart()).isEqualTo(new ApplicationStart.AtTime(Instant.parse("2026-09-29T01:00:00Z")));
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.AtTime(Instant.parse("2026-10-19T01:00:00Z")));
        assertThat(c.participationMode()).isEqualTo("online");
        assertThat(c.venue()).isEqualTo(new Venue.Online(null));
        assertThat(c.cost().path("type").asString()).isEqualTo("free");
        assertThat(c.organizer().name()).isEqualTo("데이콘");
    }

    @Test
    void 시각이_없는_마감은_날짜로만_두고_유료는_비용_정보_없음() {
        var c = content(1);
        assertThat(c.category()).isEqualTo("event");
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.OnDate(LocalDate.of(2026, 10, 20)));
        assertThat(c.participationMode()).isEqualTo("offline");
        assertThat(c.venue()).isEqualTo(new Venue.Tbd("서울 강남구 · 상세 장소는 원문 확인"));
        assertThat(c.cost()).isNull();
        assertThat(c.checkPoints()).anyMatch(p -> p.contains("참가비"));
    }

    @Test
    void 접수_기간이_없으면_행사_시작을_마감으로_쓰고_그렇게_적는다() {
        var c = content(2);
        assertThat(c.applicationStart()).isEqualTo(new ApplicationStart.Tbd());
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.AtTime(Instant.parse("2026-10-22T05:00:00Z")));
        assertThat(c.event()).isEqualTo(new EventSchedule.AtTime(Instant.parse("2026-10-22T05:00:00Z"),
                Instant.parse("2026-10-22T09:00:00Z")));
        assertThat(c.checkPoints()).anyMatch(p -> p.contains("행사 시작을 마감으로"));
    }

    @Test
    void 해를_넘기는_일정은_다음_해로_읽는다() {
        var c = content(3);
        assertThat(c.category()).isEqualTo("education");
        assertThat(c.participationMode()).isEqualTo("hybrid");
        assertThat(c.applicationStart()).isEqualTo(new ApplicationStart.OnDate(LocalDate.of(2026, 12, 20)));
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.AtTime(Instant.parse("2027-01-05T09:00:00Z")));
        assertThat(c.event()).isEqualTo(new EventSchedule.Dates(LocalDate.of(2027, 1, 12), LocalDate.of(2027, 2, 20)));
    }

    @Test
    void 같은_행사는_다시_읽어도_같은_내용이다() {
        assertThat(normalizer.normalize(records.get(0), NOW).content())
                .isEqualTo(normalizer.normalize(records.get(0), NOW.plusSeconds(86_400)).content());
    }

    @Test
    void 읽을_수_없는_날짜는_그_건만_실패한다() {
        assertThatThrownBy(() -> DevEventNormalizer.range("곧 공개", YearMonth.of(2026, 10)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
