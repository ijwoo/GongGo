package dev.imjaewoo.gonggo.ingestion;

import static org.assertj.core.api.Assertions.assertThat;

import dev.imjaewoo.gonggo.IntegrationTest;
import dev.imjaewoo.gonggo.announcement.AnnouncementQueryService;
import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementView;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.node.JsonNodeFactory;

class IngestionServiceTest extends IntegrationTest {

    @Autowired IngestionService ingestion;
    @Autowired FakeSourceAdapter fake;
    @Autowired AnnouncementQueryService query;
    @Autowired JdbcClient jdbc;

    @BeforeEach
    void setUp() {
        jdbc.sql("""
                insert into sources (id, name, attribution, allow_transform, permission_note)
                values ('fake', '테스트 출처', '테스트', true, '테스트') on conflict do nothing""").update();
    }

    @AfterEach
    void tearDown() {
        fake.items.clear();
        fake.fetchFailure = null;
        fake.snapshot = false;
        jdbc.sql("delete from announcements where source_id = 'fake'").update();
        jdbc.sql("delete from raw_records where source_id = 'fake'").update();
    }

    @Test
    void 같은_응답을_다시_수집하면_아무것도_바뀌지_않는다() {
        fake.items.put("a1", now -> incoming("a1", "공고 A", new Deadline.OnDate(LocalDate.of(2026, 10, 31)), now));

        IngestionRunView first = ingestion.run(fake, "manual").orElseThrow();
        IngestionRunView second = ingestion.run(fake, "manual").orElseThrow();

        assertThat(first.status()).isEqualTo("succeeded");
        assertThat(first.createdCount()).isEqualTo(1);
        assertThat(second.createdCount()).isZero();
        assertThat(second.unchangedCount()).isEqualTo(1);
        AnnouncementView v = query.find("fake-a1").orElseThrow();
        assertThat(v.contentVersion()).isEqualTo(1);
        assertThat(v.revisions()).isEmpty();
        // 같은 원본은 한 번만 저장된다
        assertThat(jdbc.sql("select count(*) from raw_records where source_id = 'fake'").query(Long.class).single())
                .isEqualTo(1);
    }

    @Test
    void 마감이_바뀌면_버전이_오르고_변경_이력이_남는다() {
        fake.items.put("a1", now -> incoming("a1", "공고 A", new Deadline.OnDate(LocalDate.of(2026, 10, 31)), now));
        ingestion.run(fake, "manual");

        fake.items.put("a1", now -> incoming("a1", "공고 A",
                new Deadline.AtTime(Instant.parse("2026-11-03T09:00:00Z")), now));
        IngestionRunView run = ingestion.run(fake, "manual").orElseThrow();

        assertThat(run.changedCount()).isEqualTo(1);
        AnnouncementView v = query.find("fake-a1").orElseThrow();
        assertThat(v.contentVersion()).isEqualTo(2);
        assertThat(v.applicationDeadline()).isEqualTo(new Deadline.AtTime(Instant.parse("2026-11-03T09:00:00Z")));
        assertThat(v.revisions()).singleElement().satisfies(r -> {
            assertThat(r.kind()).isEqualTo("deadline");
            assertThat(r.version()).isEqualTo(2);
            // 시각 미공지는 23:59로 바꾸지 않고 그대로 적는다. 시각은 서울 기준
            assertThat(r.before()).isEqualTo("10월 31일 (토) · 시각 미공지");
            assertThat(r.after()).isEqualTo("11월 3일 (화) 18:00");
        });
    }

    @Test
    void 알릴_필요_없는_변경은_버전을_올리지_않는다() {
        fake.items.put("a1", now -> incoming("a1", "공고 A", new Deadline.Rolling(), now));
        ingestion.run(fake, "manual");
        fake.items.put("a1", now -> incoming("a1", "공고 A (오타 수정)", new Deadline.Rolling(), now));

        IngestionRunView run = ingestion.run(fake, "manual").orElseThrow();

        assertThat(run.changedCount()).isEqualTo(1);
        AnnouncementView v = query.find("fake-a1").orElseThrow();
        assertThat(v.title()).isEqualTo("공고 A (오타 수정)");
        assertThat(v.contentVersion()).isEqualTo(1);
        assertThat(v.revisions()).isEmpty();
    }

    @Test
    void 한_건이_잘못돼도_나머지는_저장된다() {
        fake.items.put("a1", now -> incoming("a1", "공고 A", new Deadline.Tbd(), now));
        fake.items.put("a2", now -> {
            throw new IllegalArgumentException("필수 값 title이(가) 비어 있습니다.");
        });

        IngestionRunView run = ingestion.run(fake, "manual").orElseThrow();

        assertThat(run.status()).isEqualTo("succeeded");
        assertThat(run.createdCount()).isEqualTo(1);
        assertThat(run.errorCount()).isEqualTo(1);
        assertThat(run.errorMessage()).contains("a2").contains("title");
        assertThat(query.find("fake-a1")).isPresent();
    }

    @Test
    void 가져오기에_실패하면_실행이_failed로_남는다() {
        fake.fetchFailure = new IllegalStateException("응답에 필수 필드가 없습니다: [pbanc_sn]");

        IngestionRunView run = ingestion.run(fake, "manual").orElseThrow();

        assertThat(run.status()).isEqualTo("failed");
        assertThat(run.errorMessage()).contains("pbanc_sn");
        assertThat(run.finishedAt()).isNotNull();
    }

    @Test
    void 목록_전체를_주는_출처에서_내려간_공고는_마감된다() {
        fake.snapshot = true;
        fake.items.put("a1", now -> incoming("a1", "공고 A", new Deadline.Rolling(), now));
        fake.items.put("a2", now -> incoming("a2", "공고 B", new Deadline.Rolling(), now));
        ingestion.run(fake, "manual");

        fake.items.remove("a2");
        IngestionRunView run = ingestion.run(fake, "manual").orElseThrow();

        assertThat(run.changedCount()).isEqualTo(1);
        assertThat(query.find("fake-a1").orElseThrow().status()).isEqualTo("active");
        AnnouncementView closed = query.find("fake-a2").orElseThrow();
        assertThat(closed.status()).isEqualTo("cancelled");
        assertThat(closed.revisions()).singleElement().satisfies(r -> assertThat(r.kind()).isEqualTo("cancel"));

        // 다시 돌려도 이미 마감된 공고는 그대로다
        assertThat(ingestion.run(fake, "manual").orElseThrow().changedCount()).isZero();
    }

    @Test
    void 빈_응답이면_아무것도_마감하지_않는다() {
        fake.snapshot = true;
        fake.items.put("a1", now -> incoming("a1", "공고 A", new Deadline.Rolling(), now));
        ingestion.run(fake, "manual");

        fake.items.clear();
        ingestion.run(fake, "manual");

        assertThat(query.find("fake-a1").orElseThrow().status()).isEqualTo("active");
    }

    private static Incoming incoming(String externalId, String title, Deadline deadline, Instant now) {
        var conditions = JsonNodeFactory.instance.arrayNode();
        AnnouncementContent c = new AnnouncementContent("fake-" + externalId, title,
                new Organizer("테스트 기관", null, "#3182F6"), "startup", "fake", "https://example.com/" + externalId,
                "테스트 출처", Instant.parse("2026-10-01T00:00:00Z"), Instant.parse("2026-10-01T00:00:00Z"),
                new ApplicationStart.Tbd(), deadline, new EventSchedule.Tbd(), "online", new Venue.Online(null),
                List.of(), null, null, null, conditions, List.of(), List.of(), "active");
        return Incoming.fresh(externalId, c, now);
    }
}
