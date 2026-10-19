package dev.imjaewoo.gonggo.announcement.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import dev.imjaewoo.gonggo.common.Seoul;
import java.time.Instant;
import java.time.LocalDate;

/** 신청 마감. 웹 deadlineSchema와 같은 모양. 시각이 공지되지 않으면 날짜만 둔다 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = Deadline.AtTime.class, name = "datetime"),
    @JsonSubTypes.Type(value = Deadline.OnDate.class, name = "date"),
    @JsonSubTypes.Type(value = Deadline.Rolling.class, name = "rolling"),
    @JsonSubTypes.Type(value = Deadline.UntilBudget.class, name = "untilBudget"),
    @JsonSubTypes.Type(value = Deadline.Tbd.class, name = "tbd"),
})
public sealed interface Deadline {

    record AtTime(Instant at) implements Deadline {
    }

    record OnDate(LocalDate date) implements Deadline {
    }

    record Rolling() implements Deadline {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record UntilBudget(String note) implements Deadline {
    }

    record Tbd() implements Deadline {
    }

    default Deadline shiftDays(long days) {
        return switch (this) {
            case AtTime t -> new AtTime(t.at().plusSeconds(days * 86_400));
            case OnDate d -> new OnDate(d.date().plusDays(days));
            default -> this;
        };
    }

    /** 변경 이력에 남기는 표기. 웹 formatDeadline과 같다 */
    default String format() {
        return switch (this) {
            case AtTime t -> Seoul.formatDateTime(t.at());
            case OnDate d -> Seoul.formatDate(d.date()) + " · 시각 미공지";
            case Rolling r -> "상시 모집";
            case UntilBudget u -> "예산 소진 시 마감";
            case Tbd t -> "미정";
        };
    }
}
