package dev.imjaewoo.gonggo.ingestion.demo;

import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementRevisionView;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementView;
import dev.imjaewoo.gonggo.common.Seoul;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 데모 공고 34건(웹 데모와 같은 데이터, scripts/export-demo-data.ts로 만든다).
 * 시드의 날짜는 anchor 기준이라, 넣을 때 (기준일 - anchor)일만큼 옮긴다.
 * 날마다 다시 돌리면 날짜가 바뀌어 가짜 변경 이력이 생기므로 정기 수집에서는 빠진다.
 */
@Component
public class DemoSourceAdapter implements SourceAdapter {

    private final JsonMapper json;
    private final Clock clock;
    private final boolean enabled;
    private final String anchorDate;

    public DemoSourceAdapter(JsonMapper json, Clock clock, @Value("${gonggo.demo.enabled:true}") boolean enabled,
            @Value("${gonggo.demo.anchor-date:}") String anchorDate) {
        this.json = json;
        this.clock = clock;
        this.enabled = enabled;
        this.anchorDate = anchorDate;
    }

    @Override
    public String sourceId() {
        return "demo";
    }

    @Override
    public boolean enabled() {
        return enabled;
    }

    @Override
    public boolean scheduled() {
        return false;
    }

    @Override
    public List<SourceRecord> fetch() {
        JsonNode root;
        try (InputStream in = new ClassPathResource("demo/announcements.json").getInputStream()) {
            root = json.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        long shift = ChronoUnit.DAYS.between(LocalDate.parse(root.path("anchor").asString()), targetDate());
        List<SourceRecord> records = new ArrayList<>();
        for (JsonNode item : root.path("items")) {
            // 원본 저장(raw_records)에는 시드 그대로 두고, 날짜 이동은 정규화에서 한다
            records.add(new SourceRecord(item.path("id").asString(), json.createObjectNode()
                    .put("shiftDays", shift).set("item", item)));
        }
        return records;
    }

    @Override
    public Incoming normalize(SourceRecord record, Instant now) {
        long days = record.payload().path("shiftDays").asLong();
        AnnouncementView v = json.treeToValue(record.payload().path("item"), AnnouncementView.class);
        AnnouncementContent content = new AnnouncementContent(v.id(), v.title(), v.organizer(), v.category(),
                v.sourceId(), v.sourceUrl(), v.sourceName(), shift(v.publishedAt(), days),
                shift(v.sourceUpdatedAt(), days), v.applicationStart().shiftDays(days),
                v.applicationDeadline().shiftDays(days), v.event().shiftDays(days), v.participationMode(), v.venue(),
                v.eligibilityRegions(), v.teamSize(), v.cost(), v.supportAmount(), v.conditions(),
                v.requiredDocuments(), v.checkPoints(), v.status());
        List<AnnouncementRevisionView> history = v.revisions().stream()
                .map(r -> new AnnouncementRevisionView(r.id(), r.version(), shift(r.changedAt(), days), r.kind(),
                        r.summary(), r.before(), r.after()))
                .toList();
        return new Incoming(v.id(), content, shift(v.lastCheckedAt(), days), v.contentVersion(), history);
    }

    private LocalDate targetDate() {
        return StringUtils.hasText(anchorDate) ? LocalDate.parse(anchorDate) : Seoul.dateOf(clock.instant());
    }

    private static Instant shift(Instant instant, long days) {
        return instant.plus(days, ChronoUnit.DAYS);
    }
}
