package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.common.Seoul;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/** 목록 필터·정렬. 판정 규칙은 웹 applicationState·sortAnnouncements와 같다 */
final class AnnouncementSpecs {

    private AnnouncementSpecs() {
    }

    static Specification<Announcement> matching(AnnouncementSearch s, Instant now) {
        return (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            for (String token : s.q().toLowerCase(Locale.ROOT).split("\\s+")) {
                if (!token.isEmpty()) {
                    where.add(cb.like(searchText(root, cb), "%" + escapeLike(token) + "%", '\\'));
                }
            }
            if (!s.categories().isEmpty()) {
                where.add(root.get("category").in(s.categories()));
            }
            if (!s.modes().isEmpty()) {
                where.add(root.get("participationMode").in(s.modes()));
            }
            if (!s.regions().isEmpty()) {
                // 지역 필터는 행사 장소 기준(확정 장소의 주소 또는 시·구 단위 지역). 온라인·지역 미상은 빠진다
                List<Predicate> any = s.regions().stream()
                        .map(r -> cb.or(
                                cb.and(cb.equal(root.get("venueStatus"), "confirmed"),
                                        cb.like(root.get("venueAddress"), escapeLike(r) + "%", '\\')),
                                cb.and(cb.equal(root.get("venueStatus"), "tbd"),
                                        cb.like(root.get("venueArea"), escapeLike(r) + "%", '\\'))))
                        .toList();
                where.add(cb.or(any.toArray(Predicate[]::new)));
            }
            if (!s.includeClosed()) {
                where.add(cb.not(closed(root, cb, now)));
            } else if (s.closedWithinDays() != null) {
                where.add(cb.or(cb.not(closed(root, cb, now)),
                        closedSince(root, cb, now.minus(s.closedWithinDays(), ChronoUnit.DAYS))));
            }
            // 페이지 수를 세는 쿼리에는 정렬을 붙이지 않는다
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                if ("recent".equals(s.sort())) {
                    query.orderBy(cb.desc(root.get("publishedAt")), cb.asc(root.get("id")));
                } else {
                    // 마감·취소된 공고끼리는 마감일과 관계없이 id 순(웹과 같음)
                    Expression<Instant> sortAt = cb.<Instant>selectCase()
                            .when(closed(root, cb, now), cb.nullLiteral(Instant.class))
                            .otherwise(root.get("deadlineSortAt"));
                    query.orderBy(cb.asc(deadlineRank(root, cb, now)), cb.asc(sortAt), cb.asc(root.get("id")));
                }
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
    }

    /** 취소됐거나 마감이 지난 공고. 날짜만 있는 마감은 서울 기준 그날이 끝나야 마감이다 */
    static Predicate closed(Root<Announcement> root, CriteriaBuilder cb, Instant now) {
        LocalDate today = Seoul.dateOf(now);
        return cb.or(
                cb.equal(root.get("status"), "cancelled"),
                cb.and(cb.equal(root.get("deadlineType"), "datetime"),
                        cb.lessThanOrEqualTo(root.<Instant>get("deadlineAt"), now)),
                cb.and(cb.equal(root.get("deadlineType"), "date"),
                        cb.lessThan(root.<LocalDate>get("deadlineDate"), today)));
    }

    /**
     * since 이후에 닫힌 공고. 취소는 취소가 반영된 시각(updatedAt), 마감은 마감 시각(시각 미공지는 그날 끝) 기준.
     * closed()와 함께 써야 뜻이 맞다(열린 공고도 여기 걸릴 수 있다).
     */
    private static Predicate closedSince(Root<Announcement> root, CriteriaBuilder cb, Instant since) {
        return cb.or(
                cb.and(cb.equal(root.get("status"), "cancelled"),
                        cb.greaterThanOrEqualTo(root.<Instant>get("updatedAt"), since)),
                cb.and(cb.notEqual(root.get("status"), "cancelled"),
                        cb.greaterThanOrEqualTo(root.<Instant>get("deadlineSortAt"), since)));
    }

    /** 0: 고정 마감일 있음, 1: 미정, 2: 상시·예산 소진, 3: 마감·취소 */
    private static Expression<Integer> deadlineRank(Root<Announcement> root, CriteriaBuilder cb, Instant now) {
        return cb.<Integer>selectCase()
                .when(closed(root, cb, now), 3)
                .when(root.get("deadlineType").in("datetime", "date"), 0)
                .when(cb.equal(root.get("deadlineType"), "tbd"), 1)
                .otherwise(2);
    }

    private static Expression<String> searchText(Root<Announcement> root, CriteriaBuilder cb) {
        Expression<String> text = cb.concat(root.get("title"), " ");
        text = cb.concat(text, root.<String>get("organizerName"));
        text = cb.concat(text, " ");
        text = cb.concat(text, cb.coalesce(root.<String>get("venueDistrict"), ""));
        text = cb.concat(text, " ");
        text = cb.concat(text, cb.coalesce(root.<String>get("venueName"), ""));
        text = cb.concat(text, " ");
        text = cb.concat(text, cb.coalesce(root.<String>get("venueArea"), ""));
        return cb.lower(text);
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
