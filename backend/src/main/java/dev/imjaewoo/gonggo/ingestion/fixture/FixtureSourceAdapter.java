package dev.imjaewoo.gonggo.ingestion.fixture;

import dev.imjaewoo.gonggo.announcement.AnnouncementRepository;
import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementRevisionView;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementView;
import dev.imjaewoo.gonggo.common.Seoul;
import dev.imjaewoo.gonggo.ingestion.IngestionService;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 테스트 전용 고정 공고(tests/fixtures/announcements.json). 운영에서는 등록되지 않는다.
 * gonggo.fixture.file을 지정했을 때만 켜지며(백엔드 통합 테스트·웹 E2E), 시작할 때 비어 있으면 한 번 넣는다.
 * 날짜는 파일의 anchor에서 gonggo.fixture.anchor-date(비우면 서울 기준 오늘)로 옮긴다.
 * gonggo.fixture.overrides-file이 있으면 수집할 때마다 읽어 공고별로 필드를 덮어쓴다(날짜 이동 뒤의 값).
 * E2E가 '출처에서 공고가 바뀌었다'를 실제 수집 경로(변경 감지 → 이력 → 알림)로 재현할 때 쓴다.
 */
@Component
@ConditionalOnExpression("'${gonggo.fixture.file:}' != ''")
public class FixtureSourceAdapter implements SourceAdapter, ApplicationRunner {

    public static final String SOURCE_ID = "fixture";

    private final JsonMapper json;
    private final Clock clock;
    private final JdbcClient jdbc;
    private final AnnouncementRepository announcements;
    private final IngestionService ingestion;
    private final Path file;
    private final String anchorDate;
    private final String overridesFile;

    public FixtureSourceAdapter(JsonMapper json, Clock clock, JdbcClient jdbc, AnnouncementRepository announcements,
            @Lazy IngestionService ingestion, @Value("${gonggo.fixture.file}") String file,
            @Value("${gonggo.fixture.anchor-date:}") String anchorDate,
            @Value("${gonggo.fixture.overrides-file:}") String overridesFile) {
        this.overridesFile = overridesFile;
        this.json = json;
        this.clock = clock;
        this.jdbc = jdbc;
        this.announcements = announcements;
        this.ingestion = ingestion;
        this.file = Path.of(file);
        this.anchorDate = anchorDate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbc.sql("""
                insert into sources (id, name, allowed_uses, attribution, allow_transform, permission_note)
                values ('fixture', '테스트 고정 공고', '["display", "link"]', '테스트 데이터', true, '테스트 전용')
                on conflict do nothing""").update();
        if (announcements.countBySourceId(SOURCE_ID) == 0) {
            ingestion.run(this, "startup");
        }
    }

    @Override
    public String sourceId() {
        return SOURCE_ID;
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public boolean scheduled() {
        return false;
    }

    @Override
    public List<SourceRecord> fetch() {
        JsonNode root;
        try {
            root = json.readTree(Files.readString(file));
        } catch (java.io.IOException e) {
            throw new IllegalStateException("고정 공고 파일을 읽지 못했습니다: " + file.toAbsolutePath(), e);
        }
        long shift = ChronoUnit.DAYS.between(LocalDate.parse(root.path("anchor").asString()), targetDate());
        JsonNode overrides = readOverrides();
        List<SourceRecord> records = new ArrayList<>();
        for (JsonNode item : root.path("items")) {
            var payload = json.createObjectNode().put("shiftDays", shift);
            payload.set("item", item);
            JsonNode patch = overrides.path(item.path("id").asString());
            if (patch.isObject()) {
                payload.set("override", patch);
            }
            records.add(new SourceRecord(item.path("id").asString(), payload));
        }
        return records;
    }

    @Override
    public Incoming normalize(SourceRecord record, Instant now) {
        long days = record.payload().path("shiftDays").asLong();
        AnnouncementView v = json.treeToValue(record.payload().path("item"), AnnouncementView.class);
        AnnouncementContent content = new AnnouncementContent(v.id(), v.title(), v.organizer(), v.category(),
                SOURCE_ID, v.sourceUrl(), v.sourceName(), shift(v.publishedAt(), days),
                shift(v.sourceUpdatedAt(), days), v.applicationStart().shiftDays(days),
                v.applicationDeadline().shiftDays(days), v.event().shiftDays(days), v.participationMode(), v.venue(),
                v.eligibilityRegions(), v.teamSize(), v.cost(), v.supportAmount(), v.conditions(),
                v.requiredDocuments(), v.checkPoints(), v.status());
        JsonNode patch = record.payload().path("override");
        if (patch.isObject()) {
            var node = (tools.jackson.databind.node.ObjectNode) json.valueToTree(content);
            patch.properties().forEach(e -> node.set(e.getKey(), e.getValue()));
            content = json.treeToValue(node, AnnouncementContent.class);
        }
        List<AnnouncementRevisionView> history = v.revisions().stream()
                .map(r -> new AnnouncementRevisionView(r.id(), r.version(), shift(r.changedAt(), days), r.kind(),
                        r.summary(), r.before(), r.after()))
                .toList();
        return new Incoming(v.id(), content, shift(v.lastCheckedAt(), days), v.contentVersion(), history);
    }

    private JsonNode readOverrides() {
        if (!StringUtils.hasText(overridesFile) || !Files.exists(Path.of(overridesFile))) {
            return json.createObjectNode();
        }
        try {
            return json.readTree(Files.readString(Path.of(overridesFile)));
        } catch (java.io.IOException e) {
            throw new IllegalStateException("고정 공고 덮어쓰기 파일을 읽지 못했습니다: " + overridesFile, e);
        }
    }

    private LocalDate targetDate() {
        return StringUtils.hasText(anchorDate) ? LocalDate.parse(anchorDate) : Seoul.dateOf(clock.instant());
    }

    private static Instant shift(Instant instant, long days) {
        return instant.plus(days, ChronoUnit.DAYS);
    }
}
