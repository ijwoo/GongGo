package dev.imjaewoo.gonggo.ingestion.devevent;

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
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * DevEventParser가 뽑은 행사 한 건 → 공고. 원문에 없는 값은 만들지 않는다.
 * - 날짜에 연도가 없어 그 행사가 놓인 월(`26년 10월`)에서 가장 가까운 연도로 정한다(12월 절의 1월 마감 등)
 * - 시각이 없으면 날짜만. 장소는 '오프라인(서울 강남구)'처럼 구 단위라 좌표 없이 장소 미정 + 메모로 둔다
 * - 접수 기간이 없고 행사 일시만 있으면 행사 시작을 마감으로 쓰고, 그렇게 했다고 확인 사항에 적는다
 * - 유료는 금액을 모르므로 비용 '정보 없음'(null) + 확인 사항
 */
public class DevEventNormalizer {

    public static final String SOURCE_ID = "devevent";
    private static final String SOURCE_NAME = "Dev-Event";
    private static final String[] PALETTE = {"#3182F6", "#00A86B", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9"};
    private static final Pattern POINT = Pattern.compile(
            "(\\d{1,2})\\.\\s*(\\d{1,2})\\.?\\s*(?:\\([^)]*\\))?\\s*(\\d{1,2}:\\d{2})?");
    private static final Pattern OFFLINE_PLACE = Pattern.compile("오프라인\\s*\\(([^)]+)\\)");

    private final JsonMapper json;

    public DevEventNormalizer(JsonMapper json) {
        this.json = json;
    }

    /** 날짜 하나. time이 null이면 시각 미공지 */
    record Point(LocalDate date, LocalTime time) {

        Instant instant() {
            return date.atTime(time).atZone(Seoul.ZONE).toInstant();
        }
    }

    record Range(Point start, Point end) {
    }

    public Incoming normalize(SourceRecord record, Instant now) {
        JsonNode item = record.payload();
        String title = require(item, "title");
        String url = require(item, "url");
        URI.create(url);
        YearMonth month = YearMonth.parse(require(item, "month"));
        List<String> tags = new ArrayList<>();
        item.path("tags").forEach(t -> tags.add(t.asString()));
        String organizer = text(item, "organizer");
        if (organizer == null) {
            organizer = "주최 미상";
        }

        Range apply = range(text(item, "apply"), month);
        Range when = range(text(item, "when"), month);
        List<String> checkPoints = new ArrayList<>();

        ApplicationStart start = apply != null ? startOf(apply.start()) : new ApplicationStart.Tbd();
        Deadline deadline;
        if (apply != null) {
            deadline = deadlineOf(apply.end() != null ? apply.end() : apply.start());
        } else if (when != null) {
            deadline = deadlineOf(when.start());
            checkPoints.add("접수 기간이 따로 공지되지 않아 행사 시작을 마감으로 표시했어요");
        } else {
            deadline = new Deadline.Tbd();
        }
        EventSchedule event = when != null ? scheduleOf(when) : new EventSchedule.Tbd();

        boolean online = tags.stream().anyMatch(t -> t.startsWith("온라인"));
        boolean offline = tags.stream().anyMatch(t -> t.startsWith("오프라인"));
        String mode = online && offline ? "hybrid" : offline ? "offline" : "online";
        String place = tags.stream().map(OFFLINE_PLACE::matcher).filter(Matcher::find).map(m -> m.group(1).strip())
                .findFirst().orElse(null);
        Venue venue = offline
                ? new Venue.Tbd(place != null ? place + " · 상세 장소는 원문 확인" : null)
                : new Venue.Online(null);

        JsonNode cost = null;
        if (tags.contains("무료")) {
            cost = json.createObjectNode().put("type", "free");
        } else if (tags.contains("유료")) {
            checkPoints.add("유료 행사예요. 참가비는 원문에서 확인하세요");
        }
        checkPoints.add("Dev-Event 커뮤니티 목록에서 가져온 공고예요. 세부 내용은 원문을 확인하세요");

        // 게시 시각은 실행마다 바뀌면 안 된다(가짜 변경). 접수 시작 → 행사 시작 → 그 월 1일 순으로 쓴다
        LocalDate publishedDate = apply != null ? apply.start().date()
                : when != null ? when.start().date() : month.atDay(1);
        Instant published = publishedDate.atStartOfDay(Seoul.ZONE).toInstant();

        AnnouncementContent content = new AnnouncementContent(
                SOURCE_ID + "-" + record.externalId(),
                title,
                new Organizer(organizer, null, PALETTE[Math.floorMod(organizer.hashCode(), PALETTE.length)]),
                category(tags),
                SOURCE_ID,
                url,
                SOURCE_NAME,
                published,
                published,
                start,
                deadline,
                event,
                mode,
                venue,
                List.of(),
                null,
                cost,
                null,
                json.createArrayNode(),
                List.of(),
                checkPoints,
                "active");
        return Incoming.fresh(record.externalId(), content, now);
    }

    /** 대회 → 해커톤, 교육·부트캠프 → 교육, 나머지(세미나·모임·컨퍼런스) → 개발자 행사 */
    static String category(List<String> tags) {
        if (tags.contains("대회") || tags.contains("해커톤") || tags.contains("공모전")) {
            return "hackathon";
        }
        if (tags.contains("교육") || tags.contains("부트캠프")) {
            return "education";
        }
        return "event";
    }

    /** "10. 07(수) 12:00 ~ 10. 20(화) 13:00" 또는 "10. 22(목) 14:00". 읽을 수 없으면 예외(그 건만 실패) */
    static Range range(String raw, YearMonth month) {
        if (raw == null) {
            return null;
        }
        String[] parts = raw.split("~", 2);
        Point start = point(parts[0], month);
        Point end = parts.length > 1 && !parts[1].isBlank() ? point(parts[1], month) : null;
        // 끝 날짜가 시작보다 앞이면 해를 넘긴 것(12. 20 ~ 01. 05)
        if (end != null && end.date().isBefore(start.date())) {
            end = new Point(end.date().plusYears(1), end.time());
        }
        return new Range(start, end);
    }

    private static Point point(String raw, YearMonth month) {
        Matcher m = POINT.matcher(raw.strip());
        if (!m.lookingAt()) {
            throw new IllegalArgumentException("날짜를 읽을 수 없습니다: " + raw.strip());
        }
        int mm = Integer.parseInt(m.group(1));
        int dd = Integer.parseInt(m.group(2));
        LocalDate anchor = month.atDay(15);
        LocalDate date = IntStream.of(month.getYear() - 1, month.getYear(), month.getYear() + 1)
                .mapToObj(y -> LocalDate.of(y, mm, dd))
                .min(Comparator.comparingLong(d -> Math.abs(ChronoUnit.DAYS.between(anchor, d))))
                .orElseThrow();
        return new Point(date, m.group(3) != null ? LocalTime.parse(pad(m.group(3))) : null);
    }

    private static String pad(String hhmm) {
        return hhmm.length() == 4 ? "0" + hhmm : hhmm;
    }

    private static ApplicationStart startOf(Point p) {
        return p.time() != null ? new ApplicationStart.AtTime(p.instant()) : new ApplicationStart.OnDate(p.date());
    }

    private static Deadline deadlineOf(Point p) {
        return p.time() != null ? new Deadline.AtTime(p.instant()) : new Deadline.OnDate(p.date());
    }

    /** 시작·끝 모두 시각이 있으면 시각으로, 아니면 날짜로(하루짜리는 시작=끝) */
    private static EventSchedule scheduleOf(Range r) {
        Point end = r.end() != null ? r.end() : r.start();
        if (r.start().time() != null && end.time() != null && r.end() != null) {
            return new EventSchedule.AtTime(r.start().instant(), end.instant());
        }
        return new EventSchedule.Dates(r.start().date(), end.date());
    }

    private static String require(JsonNode item, String field) {
        String v = text(item, field);
        if (v == null) {
            throw new IllegalArgumentException("필수 값 " + field + "이(가) 비어 있습니다.");
        }
        return v;
    }

    private static String text(JsonNode item, String field) {
        if (!item.hasNonNull(field)) {
            return null;
        }
        String v = item.get(field).asString().strip();
        return v.isEmpty() ? null : v;
    }
}
