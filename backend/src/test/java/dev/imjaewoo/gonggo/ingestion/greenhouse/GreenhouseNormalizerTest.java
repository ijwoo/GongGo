package dev.imjaewoo.gonggo.ingestion.greenhouse;

import static org.assertj.core.api.Assertions.assertThat;

import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** 실제 설정 파일(sources/greenhouse-boards.yml)의 거르기 조건으로 검사한다. 픽스처는 실제 응답 모양이다 */
class GreenhouseNormalizerTest {

    private static final Instant NOW = Instant.parse("2026-10-19T01:00:00Z");
    private final JsonMapper json = JsonMapper.builder().build();
    private GreenhouseNormalizer normalizer;
    private List<JsonNode> jobs;

    @BeforeEach
    void setUp() throws Exception {
        var env = new StandardEnvironment();
        new YamlPropertySourceLoader().load("boards", new ClassPathResource("sources/greenhouse-boards.yml"))
                .forEach(env.getPropertySources()::addLast);
        normalizer = new GreenhouseNormalizer(
                Binder.get(env).bind("gonggo.greenhouse", GreenhouseProperties.class).get());
        try (InputStream in = new ClassPathResource("greenhouse/jobs.json").getInputStream()) {
            jobs = new ArrayList<>();
            json.readTree(in).path("jobs").forEach(jobs::add);
        }
    }

    private SourceRecord record(JsonNode job) {
        ObjectNode payload = ((ObjectNode) job.deepCopy()).put("board", "moloco").put("company", "몰로코");
        return new SourceRecord(GreenhouseNormalizer.externalId("moloco", job), payload);
    }

    @Test
    void 국내_근무지의_개발_직군만_남긴다() {
        assertThat(jobs.stream().filter(normalizer::accepts).map(j -> j.path("id").asLong()))
                .containsExactly(111L, 222L);
    }

    @Test
    void 마감일이_없으면_상시_모집이고_근무지는_메모와_시_단위_지역으로_둔다() {
        var c = normalizer.normalize(record(jobs.get(0)), NOW).content();
        assertThat(c.id()).isEqualTo("greenhouse-moloco-111");
        assertThat(c.category()).isEqualTo("job");
        assertThat(c.organizer().name()).isEqualTo("몰로코");
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.Rolling());
        // 몰로코는 사무실 구를 모르므로 서울(시 단위)
        assertThat(c.venue()).isEqualTo(new Venue.Tbd("근무지 Seoul, South Korea", new Venue.Area("서울", null)));
        assertThat(c.publishedAt()).isEqualTo(Instant.parse("2026-09-03T19:26:16Z"));
        assertThat(c.conditions().isArray()).isTrue();
    }

    @Test
    void 마감일이_있으면_그_시각을_마감으로_쓴다() {
        var c = normalizer.normalize(record(jobs.get(1)), NOW).content();
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.AtTime(Instant.parse("2026-11-30T14:59:00Z")));
    }

    @Test
    void 근무지_지역은_먼저_나온_도시이고_서울이면_회사_사무실_구를_쓴다() {
        assertThat(GreenhouseNormalizer.areaOf("Seoul, South Korea", "서울 강남구")).contains("서울 강남구");
        assertThat(GreenhouseNormalizer.areaOf("SEOUL", null)).contains("서울");
        assertThat(GreenhouseNormalizer.areaOf("South Korea", "서울 송파구")).contains("서울 송파구");
        assertThat(GreenhouseNormalizer.areaOf("South Korea", null)).isEmpty();
        assertThat(GreenhouseNormalizer.areaOf("Hwaseong(Dongtan), South Korea / Seoul, South Korea", "서울 강남구"))
                .contains("경기 화성");
        assertThat(GreenhouseNormalizer.areaOf("Pangyo, Korea", "서울 강남구")).contains("경기 성남");
    }
}
