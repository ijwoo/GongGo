package dev.imjaewoo.gonggo.announcement.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.time.Instant;
import java.time.LocalDate;

/** 신청 시작 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = ApplicationStart.AtTime.class, name = "datetime"),
    @JsonSubTypes.Type(value = ApplicationStart.OnDate.class, name = "date"),
    @JsonSubTypes.Type(value = ApplicationStart.Tbd.class, name = "tbd"),
})
public sealed interface ApplicationStart {

    record AtTime(Instant at) implements ApplicationStart {
    }

    record OnDate(LocalDate date) implements ApplicationStart {
    }

    record Tbd() implements ApplicationStart {
    }

    default ApplicationStart shiftDays(long days) {
        return switch (this) {
            case AtTime t -> new AtTime(t.at().plusSeconds(days * 86_400));
            case OnDate d -> new OnDate(d.date().plusDays(days));
            case Tbd t -> t;
        };
    }
}
