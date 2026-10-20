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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

/**
 * Greenhouse 채용 공고 한 건 → 공고. 원문에 없는 값은 만들지 않는다.
 * - 마감일이 있으면 그 시각, 없으면 상시 모집. 목록에서 내려가면 IngestionService가 마감 처리한다
 * - 근무지는 문자열뿐이라 정확한 장소는 만들지 않는다(장소 미정 + 근무지 메모). 지도에 놓을 수 있게
 *   시·구 단위 지역만 붙인다: 서울이면 회사 사무실 구(office), 판교·화성 같은 도시는 그 시. 좌표는 AreaGeocoder가 채운다
 * - 레코드 payload는 Greenhouse job 객체에 board(token)·company(이름)를 더한 것
 */
public class GreenhouseNormalizer {

    public static final String SOURCE_ID = "greenhouse";
    private static final String[] PALETTE = {"#3182F6", "#00A86B", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9"};

    /** 근무지 문자열의 도시 → 지역 이름. 서울은 회사 사무실 구가 있으면 그것을 쓴다 */
    private static final List<Map.Entry<Pattern, String>> CITIES = List.of(
            Map.entry(Pattern.compile("pangyo|판교|seongnam|성남|bundang|분당", Pattern.CASE_INSENSITIVE), "경기 성남"),
            Map.entry(Pattern.compile("hwaseong|화성|dongtan|동탄", Pattern.CASE_INSENSITIVE), "경기 화성"),
            Map.entry(Pattern.compile("suwon|수원", Pattern.CASE_INSENSITIVE), "경기 수원"),
            Map.entry(Pattern.compile("busan|부산", Pattern.CASE_INSENSITIVE), "부산"),
            Map.entry(Pattern.compile("daejeon|대전", Pattern.CASE_INSENSITIVE), "대전"),
            Map.entry(Pattern.compile("seoul|서울", Pattern.CASE_INSENSITIVE), "서울"));
    private static final Pattern KOREA = Pattern.compile("korea|한국", Pattern.CASE_INSENSITIVE);

    private final Pattern location;
    private final Pattern title;
    private final Map<String, String> offices = new HashMap<>();

    public GreenhouseNormalizer(GreenhouseProperties props) {
        this.location = compile(props.locationPattern());
        this.title = compile(props.titlePattern());
        if (props.boards() != null) {
            for (var b : props.boards()) {
                if (b.office() != null && !b.office().isBlank()) {
                    offices.put(b.token(), b.office().strip());
                }
            }
        }
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
                new Venue.Tbd(place.isEmpty() ? null : "근무지 " + place,
                        areaOf(place, offices.get(job.path("board").asString(""))).map(l -> new Venue.Area(l, null))
                                .orElse(null)),
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

    /**
     * 근무지 문자열에서 가장 먼저 나오는 도시의 지역. 서울(또는 도시 없이 한국만)이면 회사 사무실 구를 쓰고,
     * 사무실을 모르면 서울은 '서울', 한국만 적힌 경우는 지역 없음.
     */
    static Optional<String> areaOf(String place, String office) {
        String best = null;
        int at = Integer.MAX_VALUE;
        for (var city : CITIES) {
            Matcher m = city.getKey().matcher(place);
            if (m.find() && m.start() < at) {
                at = m.start();
                best = city.getValue();
            }
        }
        boolean seoulOffice = office != null && office.startsWith("서울");
        if ("서울".equals(best) || (best == null && KOREA.matcher(place).find())) {
            return seoulOffice ? Optional.of(office) : Optional.ofNullable(best);
        }
        return Optional.ofNullable(best);
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
