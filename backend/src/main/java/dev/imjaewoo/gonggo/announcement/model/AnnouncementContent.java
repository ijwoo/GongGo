package dev.imjaewoo.gonggo.announcement.model;

import java.time.Instant;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * 출처에서 정규화한 공고 내용. 버전·이력·확인 시각처럼 서버가 붙이는 값은 빠져 있다.
 * 이 값의 해시가 바뀌었는지로 변경을 감지한다.
 * 서버가 해석하지 않는 값(팀 규모·비용·지원 규모·조건)은 JsonNode 그대로 둔다. null은 '정보 없음'.
 */
public record AnnouncementContent(
        String id,
        String title,
        Organizer organizer,
        String category,
        String sourceId,
        String sourceUrl,
        String sourceName,
        Instant publishedAt,
        Instant sourceUpdatedAt,
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
        String status) {
}
