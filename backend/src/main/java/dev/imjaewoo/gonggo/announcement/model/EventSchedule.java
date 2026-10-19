package dev.imjaewoo.gonggo.announcement.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.time.Instant;
import java.time.LocalDate;

/** 행사·교육 일정. dates의 end는 마지막 날(포함) */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = EventSchedule.Dates.class, name = "dates"),
    @JsonSubTypes.Type(value = EventSchedule.AtTime.class, name = "datetime"),
    @JsonSubTypes.Type(value = EventSchedule.Tbd.class, name = "tbd"),
    @JsonSubTypes.Type(value = EventSchedule.Ongoing.class, name = "ongoing"),
})
public sealed interface EventSchedule {

    record Dates(LocalDate start, LocalDate end) implements EventSchedule {
    }

    record AtTime(Instant start, Instant end) implements EventSchedule {
    }

    record Tbd() implements EventSchedule {
    }

    record Ongoing() implements EventSchedule {
    }

    default EventSchedule shiftDays(long days) {
        return switch (this) {
            case Dates d -> new Dates(d.start().plusDays(days), d.end().plusDays(days));
            case AtTime t -> new AtTime(t.start().plusSeconds(days * 86_400), t.end().plusSeconds(days * 86_400));
            default -> this;
        };
    }
}
