package dev.imjaewoo.gonggo.ingestion.kstartup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 실제 매핑 파일(sources/kstartup-mapping.yml)로 정규화를 검사한다.
 * 픽스처는 가상 응답이다. 실제 응답 1건을 확보하면 sample-response.json을 바꿔 다시 돌린다.
 */
class KStartupNormalizerTest {

    private static final Instant NOW = Instant.parse("2026-10-21T01:00:00Z");
    private final JsonMapper json = JsonMapper.builder().build();
    private KStartupNormalizer normalizer;
    private List<SourceRecord> records;

    @BeforeEach
    void setUp() throws Exception {
        var env = new StandardEnvironment();
        new YamlPropertySourceLoader().load("mapping", new ClassPathResource("sources/kstartup-mapping.yml"))
                .forEach(env.getPropertySources()::addLast);
        KStartupProperties props = Binder.get(env).bind("gonggo.kstartup", KStartupProperties.class).get();
        props = new KStartupProperties("test-key", props.endpoint(), props.params(), props.pageParam(),
                props.sizeParam(), props.pageSize(), props.maxPages(), props.itemsPointer(), props.dateFormats(),
                props.fields());
        normalizer = new KStartupNormalizer(props, json);

        JsonNode root;
        try (InputStream in = new ClassPathResource("kstartup/sample-response.json").getInputStream()) {
            root = json.readTree(in);
        }
        records = new ArrayList<>();
        for (JsonNode item : root.at(props.itemsPointer())) {
            records.add(new SourceRecord(normalizer.externalId(item), item));
        }
    }

    @Test
    void 날짜만_있는_마감은_날짜로만_저장한다() {
        var in = normalizer.normalize(records.get(0), NOW);
        var c = in.content();

        assertThat(in.externalId()).isEqualTo("900001");
        assertThat(c.id()).isEqualTo("kstartup-900001");
        assertThat(c.category()).isEqualTo("startup");
        assertThat(c.applicationStart()).isEqualTo(new ApplicationStart.OnDate(LocalDate.of(2026, 10, 15)));
        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.OnDate(LocalDate.of(2026, 10, 30)));
        // 행사 장소가 없는 지원사업: 좌표를 만들지 않는다
        assertThat(c.venue()).isInstanceOf(Venue.Online.class);
        assertThat(c.eligibilityRegions()).isEmpty(); // 전국
        assertThat(c.teamSize()).isNull();
        assertThat(c.conditions().get(0).path("origin").asString()).isEqualTo("source");
        assertThat(c.conditions().get(0).has("rule")).isFalse();
        // 공고일(서울 자정)
        assertThat(c.publishedAt()).isEqualTo(Instant.parse("2026-10-14T15:00:00Z"));
    }

    @Test
    void 마감이_비어_있으면_미정이고_지역을_묶는다() {
        var c = normalizer.normalize(records.get(1), NOW).content();

        assertThat(c.applicationDeadline()).isEqualTo(new Deadline.Tbd());
        assertThat(c.eligibilityRegions()).containsExactly("서울", "경기");
        assertThat(c.conditions().size()).isZero();
    }

    @Test
    void 공고명이_비어_있으면_그_건만_실패한다() {
        assertThatThrownBy(() -> normalizer.normalize(records.get(2), NOW))
                .hasMessageContaining("biz_pbanc_nm");
    }

    @Test
    void 필수_필드가_응답에_아예_없으면_매핑이_틀린_것이다() {
        var wrong = List.of(new SourceRecord("1", json.valueToTree(Map.of("id", 1, "title", "x"))));

        assertThatThrownBy(() -> normalizer.validate(wrong))
                .hasMessageContaining("pbanc_sn")
                .hasMessageContaining("kstartup-mapping.yml");
    }

    @Test
    void 지역_표기를_웹_지역으로_묶는다() {
        assertThat(KStartupNormalizer.regions("부산광역시, 대구")).containsExactly("경상");
        assertThat(KStartupNormalizer.regions("충북/세종")).containsExactly("충청");
        assertThat(KStartupNormalizer.regions("전국")).isEmpty();
    }
}
