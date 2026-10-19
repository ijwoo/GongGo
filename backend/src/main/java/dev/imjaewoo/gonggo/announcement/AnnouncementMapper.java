package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementRevisionView;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementView;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 공고 내용(레코드) ↔ 저장 모양(엔티티 열) 변환과 내용 해시 */
@Component
public class AnnouncementMapper {

    private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {
    };

    private final JsonMapper json;

    public AnnouncementMapper(JsonMapper json) {
        this.json = json;
    }

    /** 내용이 같으면 같은 값. 필드 순서는 레코드 선언 순서로 고정된다 */
    public String hash(AnnouncementContent c) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(json.writeValueAsString(c).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    void apply(AnnouncementContent c, Announcement a) {
        a.setBasics(c.title(), c.organizer().name(), c.organizer().address(), c.organizer().color(), c.category(),
                c.participationMode(), c.status(), c.sourceUrl(), c.sourceName(), c.publishedAt(), c.sourceUpdatedAt());
        switch (c.applicationStart()) {
            case ApplicationStart.AtTime t -> a.setApplicationStart("datetime", t.at(), null);
            case ApplicationStart.OnDate d -> a.setApplicationStart("date", null, d.date());
            case ApplicationStart.Tbd t -> a.setApplicationStart("tbd", null, null);
        }
        switch (c.applicationDeadline()) {
            case Deadline.AtTime t -> a.setDeadline("datetime", t.at(), null, null);
            case Deadline.OnDate d -> a.setDeadline("date", null, d.date(), null);
            case Deadline.Rolling r -> a.setDeadline("rolling", null, null, null);
            case Deadline.UntilBudget u -> a.setDeadline("untilBudget", null, null, u.note());
            case Deadline.Tbd t -> a.setDeadline("tbd", null, null, null);
        }
        switch (c.event()) {
            case EventSchedule.Dates d -> a.setEvent("dates", null, null, d.start(), d.end());
            case EventSchedule.AtTime t -> a.setEvent("datetime", t.start(), t.end(), null, null);
            case EventSchedule.Tbd t -> a.setEvent("tbd", null, null, null, null);
            case EventSchedule.Ongoing o -> a.setEvent("ongoing", null, null, null, null);
        }
        switch (c.venue()) {
            case Venue.Confirmed v -> a.setVenue("confirmed", v.name(), v.address(), v.district(),
                    v.coordinates().lat(), v.coordinates().lng(), null, null);
            case Venue.Tbd v -> a.setVenue("tbd", null, null, null, null, null, v.note(), null);
            case Venue.Online v -> a.setVenue("online", null, null, null, null, null, null, v.platform());
        }
        a.setJson(write(c.eligibilityRegions()), writeNullable(c.teamSize()), writeNullable(c.cost()),
                writeNullable(c.supportAmount()), write(c.conditions()), write(c.requiredDocuments()),
                write(c.checkPoints()));
    }

    public AnnouncementContent toContent(Announcement a) {
        return new AnnouncementContent(
                a.getId(),
                a.getTitle(),
                new Organizer(a.getOrganizerName(), a.getOrganizerAddress(), a.getOrganizerColor()),
                a.getCategory(),
                a.getSourceId(),
                a.getSourceUrl(),
                a.getSourceName(),
                a.getPublishedAt(),
                a.getSourceUpdatedAt(),
                switch (a.getAppStartType()) {
                    case "datetime" -> new ApplicationStart.AtTime(a.getAppStartAt());
                    case "date" -> new ApplicationStart.OnDate(a.getAppStartDate());
                    default -> new ApplicationStart.Tbd();
                },
                switch (a.getDeadlineType()) {
                    case "datetime" -> new Deadline.AtTime(a.getDeadlineAt());
                    case "date" -> new Deadline.OnDate(a.getDeadlineDate());
                    case "rolling" -> new Deadline.Rolling();
                    case "untilBudget" -> new Deadline.UntilBudget(a.getDeadlineNote());
                    default -> new Deadline.Tbd();
                },
                switch (a.getEventType()) {
                    case "dates" -> new EventSchedule.Dates(a.getEventStartDate(), a.getEventEndDate());
                    case "datetime" -> new EventSchedule.AtTime(a.getEventStartAt(), a.getEventEndAt());
                    case "ongoing" -> new EventSchedule.Ongoing();
                    default -> new EventSchedule.Tbd();
                },
                a.getParticipationMode(),
                switch (a.getVenueStatus()) {
                    case "confirmed" -> new Venue.Confirmed(a.getVenueName(), a.getVenueAddress(), a.getVenueDistrict(),
                            new Venue.Coordinates(a.getVenueLat(), a.getVenueLng()));
                    case "online" -> new Venue.Online(a.getVenuePlatform());
                    default -> new Venue.Tbd(a.getVenueNote());
                },
                json.readValue(a.getEligibilityRegions(), STRINGS),
                readNullable(a.getTeamSize()),
                readNullable(a.getCost()),
                readNullable(a.getSupportAmount()),
                json.readTree(a.getConditions()),
                json.readValue(a.getRequiredDocuments(), STRINGS),
                json.readValue(a.getCheckPoints(), STRINGS),
                a.getStatus());
    }

    public AnnouncementView toView(Announcement a, List<AnnouncementRevisionView> revisions) {
        AnnouncementContent c = toContent(a);
        return new AnnouncementView(c.id(), c.title(), c.organizer(), c.category(), c.sourceId(), c.sourceUrl(),
                c.sourceName(), c.publishedAt(), c.sourceUpdatedAt(), a.getLastCheckedAt(), c.applicationStart(),
                c.applicationDeadline(), c.event(), c.participationMode(), c.venue(), c.eligibilityRegions(),
                c.teamSize(), c.cost(), c.supportAmount(), c.conditions(), c.requiredDocuments(), c.checkPoints(),
                c.status(), a.getContentVersion(), revisions);
    }

    private String write(Object value) {
        return json.writeValueAsString(value);
    }

    private String writeNullable(JsonNode node) {
        return node == null || node.isNull() ? null : json.writeValueAsString(node);
    }

    private JsonNode readNullable(String raw) {
        return raw == null ? null : json.readTree(raw);
    }
}
