package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import tools.jackson.databind.JsonNode;

/**
 * 이전·새 내용을 비교해 사용자에게 알려야 할 변경을 고른다.
 * 제목 오타 수정처럼 알릴 필요 없는 변경은 여기서 나오지 않고, 버전도 올라가지 않는다.
 */
public final class RevisionDetector {

    public record Change(String kind, String summary, String before, String after) {
    }

    private RevisionDetector() {
    }

    public static List<Change> detect(AnnouncementContent before, AnnouncementContent after) {
        List<Change> changes = new ArrayList<>();
        if (!Objects.equals(before.applicationDeadline(), after.applicationDeadline())) {
            changes.add(new Change("deadline", "신청 마감이 변경되었습니다.",
                    before.applicationDeadline().format(), after.applicationDeadline().format()));
        }
        if (!Objects.equals(before.venue(), after.venue())) {
            changes.add(new Change("venue", "행사 장소가 변경되었습니다.", before.venue().format(), after.venue().format()));
        }
        if (!Objects.equals(before.requiredDocuments(), after.requiredDocuments())) {
            changes.add(new Change("conditions", "준비 서류가 변경되었습니다.",
                    join(before.requiredDocuments()), join(after.requiredDocuments())));
        } else if (!Objects.equals(before.conditions(), after.conditions())
                || !Objects.equals(before.eligibilityRegions(), after.eligibilityRegions())) {
            changes.add(new Change("conditions", "지원 조건이 변경되었습니다.",
                    conditionText(before), conditionText(after)));
        }
        if (!"cancelled".equals(before.status()) && "cancelled".equals(after.status())) {
            changes.add("job".equals(after.category())
                    ? new Change("cancel", "채용이 마감되었습니다.", "모집 중", "마감")
                    : new Change("cancel", "공고가 취소되었습니다.", "모집 중", "취소"));
        }
        return changes;
    }

    private static String join(List<String> items) {
        return items.isEmpty() ? "없음" : String.join(", ", items);
    }

    private static String conditionText(AnnouncementContent c) {
        List<String> parts = new ArrayList<>();
        if (!c.eligibilityRegions().isEmpty()) {
            parts.add("지역: " + String.join("·", c.eligibilityRegions()));
        }
        JsonNode conditions = c.conditions();
        if (conditions != null) {
            for (JsonNode node : conditions) {
                parts.add(node.path("text").asString());
            }
        }
        return parts.isEmpty() ? "없음" : String.join(", ", parts);
    }
}
