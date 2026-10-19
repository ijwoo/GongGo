package dev.imjaewoo.gonggo.ingestion.kstartup;

import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import dev.imjaewoo.gonggo.common.Seoul;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;

/**
 * K-Startup 응답 한 건 → 공고. 원문에 없는 값은 만들지 않는다.
 * - 마감 시각이 없으면 날짜만(23:59로 바꾸지 않음)
 * - 장소·좌표 없음(지원사업은 온라인 접수), 팀 규모·비용·지원 규모는 '정보 없음'(null)
 * - 지원 대상 문장은 규칙 없이 '확인 필요' 조건으로만 둔다
 */
public class KStartupNormalizer {

    public static final String SOURCE_ID = "kstartup";
    private static final String SOURCE_NAME = "K-Startup 사업공고";
    private static final String[] PALETTE = {"#3182F6", "#00A86B", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9"};
    private static final Map<String, String> REGION_PREFIX = Map.ofEntries(
            Map.entry("서울", "서울"), Map.entry("경기", "경기"), Map.entry("인천", "인천"), Map.entry("강원", "강원"),
            Map.entry("충북", "충청"), Map.entry("충남", "충청"), Map.entry("충청", "충청"), Map.entry("대전", "충청"),
            Map.entry("세종", "충청"), Map.entry("전북", "전라"), Map.entry("전남", "전라"), Map.entry("전라", "전라"),
            Map.entry("광주", "전라"), Map.entry("경북", "경상"), Map.entry("경남", "경상"), Map.entry("경상", "경상"),
            Map.entry("대구", "경상"), Map.entry("부산", "경상"), Map.entry("울산", "경상"), Map.entry("제주", "제주"));

    private final KStartupProperties props;
    private final JsonMapper json;

    public KStartupNormalizer(KStartupProperties props, JsonMapper json) {
        this.props = props;
        this.json = json;
    }

    /** 필수 필드(외부 ID·공고명·URL)가 응답에 아예 없으면 매핑이 틀린 것이다 → 실행 실패 */
    public void validate(List<SourceRecord> records) {
        if (records.isEmpty()) {
            return;
        }
        var f = props.fields();
        Set<String> missing = new LinkedHashSet<>();
        for (String field : List.of(f.externalId(), f.title(), f.url())) {
            if (records.stream().noneMatch(r -> r.payload().has(field))) {
                missing.add(field);
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("K-Startup 응답에 필수 필드가 없습니다: " + missing
                    + ". sources/kstartup-mapping.yml의 필드명을 실제 응답과 맞춰 주세요.");
        }
    }

    public String externalId(JsonNode item) {
        return text(item, props.fields().externalId());
    }

    public Incoming normalize(SourceRecord record, Instant now) {
        var f = props.fields();
        JsonNode item = record.payload();
        String externalId = require(item, f.externalId());
        String title = require(item, f.title());
        String url = require(item, f.url());
        URI.create(url); // 잘못된 URL이면 여기서 그 건만 실패한다

        LocalDate start = date(item, f.startDate());
        LocalDate end = date(item, f.endDate());
        Instant published = publishedAt(item, start, now);
        String organizer = orElse(text(item, f.organizer()), "주관기관 미상");

        List<String> regions = regions(text(item, f.region()));
        ArrayNode conditions = json.createArrayNode();
        String target = text(item, f.target());
        if (target != null) {
            conditions.addObject()
                    .put("id", SOURCE_ID + "-" + externalId + "-target")
                    .put("kind", "required")
                    .put("text", target.length() > 60 ? target.substring(0, 60) + "…" : target)
                    .put("evidence", target)
                    .put("origin", "source");
        }

        AnnouncementContent content = new AnnouncementContent(
                SOURCE_ID + "-" + externalId,
                title,
                new Organizer(organizer, null, PALETTE[Math.floorMod(organizer.hashCode(), PALETTE.length)]),
                "startup",
                SOURCE_ID,
                url,
                SOURCE_NAME,
                published,
                published,
                start != null ? new ApplicationStart.OnDate(start) : new ApplicationStart.Tbd(),
                end != null ? new Deadline.OnDate(end) : new Deadline.Tbd(),
                new EventSchedule.Tbd(),
                "online",
                new Venue.Online("K-Startup 온라인 접수"),
                regions,
                null,
                null,
                null,
                conditions,
                List.of(),
                List.of("지원 자격과 제출 서류는 원문 공고에서 확인하세요"),
                "active");
        return Incoming.fresh(externalId, content, now);
    }

    private Instant publishedAt(JsonNode item, LocalDate start, Instant now) {
        LocalDate date = date(item, props.fields().publishedAt());
        if (date == null) {
            date = start;
        }
        return date != null ? date.atStartOfDay(Seoul.ZONE).toInstant() : now;
    }

    /** "서울, 경기" → [서울, 경기]. "전국"이나 알 수 없는 값은 제한 없음([]) */
    static List<String> regions(String raw) {
        if (raw == null) {
            return List.of();
        }
        Set<String> out = new LinkedHashSet<>();
        for (String part : raw.split("[,/·\\s]+")) {
            REGION_PREFIX.entrySet().stream().filter(e -> part.startsWith(e.getKey())).findFirst()
                    .ifPresent(e -> out.add(e.getValue()));
        }
        return new ArrayList<>(out);
    }

    private LocalDate date(JsonNode item, String field) {
        String raw = text(item, field);
        if (raw == null) {
            return null;
        }
        for (String pattern : props.dateFormats()) {
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern(pattern);
            try {
                return pattern.contains("H") ? LocalDateTime.parse(raw, fmt).toLocalDate() : LocalDate.parse(raw, fmt);
            } catch (DateTimeParseException ignored) {
                // 다음 형식 시도
            }
        }
        throw new IllegalArgumentException(field + " 날짜 형식을 읽을 수 없습니다: " + raw);
    }

    private static String require(JsonNode item, String field) {
        String v = text(item, field);
        if (v == null) {
            throw new IllegalArgumentException("필수 값 " + field + "이(가) 비어 있습니다.");
        }
        return v;
    }

    private static String text(JsonNode item, String field) {
        if (field == null || !item.hasNonNull(field)) {
            return null;
        }
        String v = item.get(field).asString().strip();
        return v.isEmpty() ? null : v;
    }

    private static String orElse(String v, String fallback) {
        return v != null ? v : fallback;
    }
}
