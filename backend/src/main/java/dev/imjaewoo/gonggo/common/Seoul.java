package dev.imjaewoo.gonggo.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.TextStyle;
import java.util.Locale;

/**
 * 서울 기준 날짜 계산과 한국어 표기. JVM 기본 시간대에 기대지 않는다.
 * 표기 형식은 웹(src/domain/time.ts)과 같다: "10월 31일 (금) 18:00".
 */
public final class Seoul {

    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private Seoul() {
    }

    public static LocalDate dateOf(Instant instant) {
        return instant.atZone(ZONE).toLocalDate();
    }

    public static String formatDate(LocalDate date) {
        String weekday = date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.KOREAN);
        return date.getMonthValue() + "월 " + date.getDayOfMonth() + "일 (" + weekday + ")";
    }

    public static String formatDateTime(Instant instant) {
        ZonedDateTime z = instant.atZone(ZONE);
        return formatDate(z.toLocalDate()) + " " + String.format("%02d:%02d", z.getHour(), z.getMinute());
    }
}
