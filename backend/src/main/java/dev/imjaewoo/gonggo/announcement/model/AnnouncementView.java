package dev.imjaewoo.gonggo.announcement.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import tools.jackson.databind.JsonNode;

/** API 응답의 공고. 웹 announcementSchema와 필드명·모양이 같다 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record AnnouncementView(
        String id,
        String title,
        Organizer organizer,
        String category,
        String sourceId,
        String sourceUrl,
        String sourceName,
        Instant publishedAt,
        Instant sourceUpdatedAt,
        Instant lastCheckedAt,
        ApplicationStart applicationStart,
        Deadline applicationDeadline,
        EventSchedule event,
        String participationMode,
        Venue venue,
        List<String> eligibilityRegions,
        JsonNode teamSize,
        JsonNode cost,
        JsonNode supportAmount,
        JsonNode conditions,
        List<String> requiredDocuments,
        List<String> checkPoints,
        String status,
        /** 없으면 필드를 뺀다(웹 계약에서 optional) */
        @JsonInclude(JsonInclude.Include.NON_NULL) AnnouncementImage image,
        int contentVersion,
        List<AnnouncementRevisionView> revisions) {
}
