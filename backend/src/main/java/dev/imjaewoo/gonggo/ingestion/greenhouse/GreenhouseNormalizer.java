package dev.imjaewoo.gonggo.ingestion.greenhouse;

import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.net.URI;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

/**
 * Greenhouse 채용 공고 한 건 → 공고. 원문에 없는 값은 만들지 않는다.
 * - 마감일이 있으면 그 시각, 없으면 상시 모집. 목록에서 내려가면 IngestionService가 마감 처리한다
 * - 근무지는 문자열뿐이라 좌표를 만들지 않는다(장소 미정 + 근무지 메모)
 * - 레코드 payload는 Greenhouse job 객체에 board(token)·company(이름)를 더한 것
 */
public class GreenhouseNormalizer {

    public static final String SOURCE_ID = "greenhouse";
    private static final String[] PALETTE = {"#3182F6", "#00A86B", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9"};

    private final Pattern location;
    private final Pattern title;

    public GreenhouseNormalizer(GreenhouseProperties props) {
        this.location = compile(props.locationPattern());
        this.title = compile(props.titlePattern());
    }

    /** 근무지·직무명 조건에 맞는지. 패턴이 없으면 통과 */
    public boolean accepts(JsonNode job) {
        return matches(location, job.path("location").path("name").asString(""))
                && matches(title, job.path("title").asString(""));
    }

    public static String externalId(String board, JsonNode job) {
        return board + "-" + job.path("id").asString();
    }

    public Incoming normalize(SourceRecord record, Instant now) {
        JsonNode job = record.payload();
        String title = require(job, "title");
        String url = require(job, "absolute_url");
        URI.create(url);
        String company = require(job, "company");
        String place = job.path("location").path("name").asString("").strip();

        Instant published = instant(job, "first_published");
        if (published == null) {
            published = instant(job, "updated_at");
        }
        if (published == null) {
            published = now;
        }
        Instant updated = instant(job, "updated_at");
        Instant deadline = instant(job, "application_deadline");

        AnnouncementContent content = new AnnouncementContent(
                SOURCE_ID + "-" + record.externalId(),
                title,
                new Organizer(company, null, PALETTE[Math.floorMod(company.hashCode(), PALETTE.length)]),
                "job",
                SOURCE_ID,
                url,
                company + " 채용",
                published,
                updated != null ? updated : published,
                new ApplicationStart.AtTime(published),
                deadline != null ? new Deadline.AtTime(deadline) : new Deadline.Rolling(),
                new EventSchedule.Tbd(),
                "offline",
                new Venue.Tbd(place.isEmpty() ? null : "근무지 " + place),
                List.of(),
                null,
                null,
                null,
                JsonNodeFactory.instance.arrayNode(),
                List.of(),
                List.of("자격 요건·근무 조건은 원문 공고에서 확인하세요"),
                "active");
        return Incoming.fresh(record.externalId(), content, now);
    }

    private static Instant instant(JsonNode job, String field) {
        String raw = job.path(field).asString("");
        return raw.isBlank() ? null : OffsetDateTime.parse(raw).toInstant();
    }

    private static String require(JsonNode job, String field) {
        String v = job.path(field).asString("").strip();
        if (v.isEmpty()) {
            throw new IllegalArgumentException("필수 값 " + field + "이(가) 비어 있습니다.");
        }
        return v;
    }

    private static Pattern compile(String regex) {
        return regex == null || regex.isBlank() ? null : Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
    }

    private static boolean matches(Pattern p, String s) {
        return p == null || p.matcher(s).find();
    }
}
