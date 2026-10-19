package dev.imjaewoo.gonggo.announcement.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/** 실제 행사 장소. 좌표는 confirmed일 때만 있다(주최기관 주소로 대신하지 않는다) */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "status")
@JsonSubTypes({
    @JsonSubTypes.Type(value = Venue.Confirmed.class, name = "confirmed"),
    @JsonSubTypes.Type(value = Venue.Tbd.class, name = "tbd"),
    @JsonSubTypes.Type(value = Venue.Online.class, name = "online"),
})
public sealed interface Venue {

    record Coordinates(double lat, double lng) {
    }

    record Confirmed(String name, String address, String district, Coordinates coordinates) implements Venue {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Tbd(String note) implements Venue {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Online(String platform) implements Venue {
    }

    /** 변경 이력 표기. 웹 formatVenue와 같다 */
    default String format() {
        return switch (this) {
            case Confirmed c -> c.name() + " · " + c.address();
            case Online o -> o.platform() != null ? "온라인 (" + o.platform() + ")" : "온라인";
            case Tbd t -> t.note() != null ? "장소 미정 (" + t.note() + ")" : "장소 미정";
        };
    }
}
