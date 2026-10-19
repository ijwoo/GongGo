package dev.imjaewoo.gonggo.announcement;

import java.util.List;
import java.util.Set;

/**
 * 목록 조회 조건. 웹 발견 화면의 query(src/domain/discover.ts)와 같은 뜻이다.
 * 허용하지 않는 값은 버린다(웹과 같이, 손으로 고친 URL이 오류가 되지 않게).
 */
public record AnnouncementSearch(
        String q,
        List<String> categories,
        List<String> regions,
        List<String> modes,
        boolean includeClosed,
        String sort) {

    static final Set<String> CATEGORIES = Set.of("hackathon", "startup", "education", "event", "job");
    static final Set<String> REGIONS = Set.of("서울", "경기");
    static final Set<String> MODES = Set.of("online", "offline", "hybrid");

    public static AnnouncementSearch of(String q, String cat, String region, String mode, boolean includeClosed,
            String sort) {
        return new AnnouncementSearch(
                q == null ? "" : q.strip(),
                csv(cat, CATEGORIES),
                csv(region, REGIONS),
                csv(mode, MODES),
                includeClosed,
                "recent".equals(sort) ? "recent" : "deadline");
    }

    private static List<String> csv(String raw, Set<String> allowed) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(raw.split(",")).map(String::strip).filter(allowed::contains).distinct()
                .toList();
    }
}
