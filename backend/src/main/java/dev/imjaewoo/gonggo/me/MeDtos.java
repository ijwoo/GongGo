package dev.imjaewoo.gonggo.me;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * 개인 데이터 API의 요청·응답 모양. 웹의 Zod 스키마(src/domain/types.ts)와 필드명이 같다.
 * 클라이언트가 만든 id(UUID)를 그대로 쓰되, 모든 행은 (사용자, id)로 저장하므로 남의 데이터와 섞이지 않는다.
 */
public final class MeDtos {

    private MeDtos() {
    }

    static final String ID = "^[A-Za-z0-9_-]{1,64}$";

    public record UserView(long id, String nickname) {
    }

    public record Profile(
            @NotNull @Size(max = 5) List<@Pattern(regexp = "hackathon|startup|education|event|job") String> interests,
            @Pattern(regexp = "서울|경기|인천|강원|충청|전라|경상|제주") String region,
            @Pattern(regexp = "student|0-2|3-5|6\\+") String career,
            @Min(1) @Max(50) Integer teamSize,
            @Min(0) @Max(30) Integer startupYears) {
    }

    public record ChangeAlerts(boolean deadline, boolean venue, boolean conditions, boolean cancel) {
    }

    public record Saved(@NotBlank @Size(max = 80) String announcementId, @NotNull Instant savedAt,
            @Min(1) int seenVersion) {
    }

    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
    @JsonSubTypes({
        @JsonSubTypes.Type(value = Timing.AllDay.class, name = "allDay"),
        @JsonSubTypes.Type(value = Timing.Timed.class, name = "timed"),
    })
    public sealed interface Timing {

        record AllDay(@NotNull LocalDate start, @NotNull LocalDate end, boolean timeUnknown) implements Timing {
        }

        @JsonInclude(JsonInclude.Include.ALWAYS)
        record Timed(@NotNull Instant start, Instant end) implements Timing {
        }
    }

    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
    @JsonSubTypes({
        @JsonSubTypes.Type(value = Offset.Preset.class, name = "preset"),
        @JsonSubTypes.Type(value = Offset.Custom.class, name = "custom"),
    })
    public sealed interface Offset {

        int days();

        record Preset(int days) implements Offset {

            /** 미리 정한 알림은 7·3·1·0일 전만 있다 */
            @com.fasterxml.jackson.annotation.JsonIgnore
            @jakarta.validation.constraints.AssertTrue(message = "preset 알림은 7·3·1·0일 전만 됩니다.")
            boolean isKnownPreset() {
                return days == 7 || days == 3 || days == 1 || days == 0;
            }
        }

        record Custom(@Min(0) @Max(60) int days, @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String time)
                implements Offset {
        }
    }

    public record Reminder(@NotNull @Pattern(regexp = ID) String id, @NotNull @Valid Offset offset,
            @NotNull @Pattern(regexp = "inApp|email") String channel) {
    }

    public record CalendarEvent(
            @NotNull @Pattern(regexp = ID) String id,
            @Size(max = 80) String announcementId,
            @NotNull @Pattern(regexp = "deadline|event|prep") String kind,
            @NotBlank @Size(max = 80) String title,
            @NotNull @Valid Timing timing,
            @Min(1) Integer sourceVersion,
            @NotNull @Size(max = 10) List<@Valid Reminder> reminders,
            @NotNull @Size(max = 500) String memo,
            @NotNull Instant createdAt,
            @NotNull Instant updatedAt) {
    }

    public record Link(@NotNull @Pattern(regexp = "announcement|event") String kind,
            @NotBlank @Size(max = 80) String id) {
    }

    public record Notification(
            @NotNull @Pattern(regexp = ID) String id,
            @NotNull @Pattern(regexp = "reminder|change|system") String type,
            @NotBlank @Size(max = 200) String title,
            @NotNull @Size(max = 1000) String body,
            @NotNull Instant createdAt,
            boolean read,
            @Valid Link link,
            @NotBlank @Size(max = 300) String dedupeKey,
            @NotNull @Pattern(regexp = "delivered|failed") String delivery,
            @JsonInclude(JsonInclude.Include.NON_NULL) @Size(max = 300) String failureReason) {
    }

    public record ChecklistItem(@NotNull @Pattern(regexp = ID) String id, @NotBlank @Size(max = 100) String label,
            boolean done) {
    }

    public record Application(
            @NotBlank @Size(max = 80) String announcementId,
            @NotNull @Pattern(regexp = "reviewing|preparing|submitted|closed") String status,
            @NotNull @Size(max = 2000) String memo,
            @NotNull @Size(max = 50) List<@Valid ChecklistItem> checklist,
            @NotNull Instant updatedAt) {
    }

    public record SentReminders(@NotNull @Size(max = 200) List<@NotBlank @Size(max = 300) String> keys) {
    }

    /** GET /api/me — 화면이 처음 한 번 읽는 전체 개인 상태 */
    public record Me(
            UserView user,
            Profile profile,
            List<Saved> saved,
            List<CalendarEvent> events,
            List<Notification> notifications,
            List<Application> applications,
            ChangeAlerts changeAlerts,
            List<String> sentReminderKeys) {
    }
}
