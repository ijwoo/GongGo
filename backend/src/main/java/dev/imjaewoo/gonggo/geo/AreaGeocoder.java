package dev.imjaewoo.gonggo.geo;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * '서울 강남구' 같은 시·구 단위 지역을 대략 좌표로 바꾼다. 정확한 행사 장소가 아니다.
 * 결과(못 찾은 경우 포함)는 geocode_cache에 남겨 같은 지역을 다시 묻지 않는다.
 * API 오류는 캐시하지 않고 좌표 없이 넘어간다(다음 수집 때 다시 시도). 수집을 실패시키지 않는다.
 */
@Service
public class AreaGeocoder {

    private static final Logger log = LoggerFactory.getLogger(AreaGeocoder.class);

    private final KakaoLocalClient kakao;
    private final JdbcClient jdbc;

    public AreaGeocoder(KakaoLocalClient kakao, JdbcClient jdbc) {
        this.kakao = kakao;
        this.jdbc = jdbc;
    }

    public AnnouncementContent enrich(AnnouncementContent c) {
        if (!(c.venue() instanceof Venue.Tbd tbd) || tbd.area() == null || tbd.area().coordinates() != null) {
            return c;
        }
        return locate(tbd.area().label())
                .map(coords -> c.withVenue(new Venue.Tbd(tbd.note(), tbd.area().withCoordinates(coords))))
                .orElse(c);
    }

    Optional<Venue.Coordinates> locate(String label) {
        String query = label.strip();
        var cached = jdbc.sql("select found, lat, lng from geocode_cache where query = ?").param(query)
                .query((rs, i) -> rs.getBoolean("found")
                        ? Optional.of(new Venue.Coordinates(rs.getDouble("lat"), rs.getDouble("lng")))
                        : Optional.<Venue.Coordinates>empty())
                .optional();
        if (cached.isPresent()) {
            return cached.get();
        }
        if (!kakao.enabled()) {
            return Optional.empty();
        }
        try {
            Optional<KakaoLocalClient.Hit> hit = kakao.searchAddress(query);
            if (hit.isEmpty() && query.split("\\s+").length == 2 && !query.endsWith("시") && !query.endsWith("구")) {
                // '경기 성남' → '경기 성남시'
                hit = kakao.searchAddress(query + "시");
            }
            if (hit.isEmpty()) {
                hit = kakao.searchKeyword(query);
            }
            jdbc.sql("""
                    insert into geocode_cache (query, found, lat, lng, resolved_as) values (?, ?, ?, ?, ?)
                    on conflict (query) do nothing""")
                    .params(query, hit.isPresent(), hit.map(h -> h.coordinates().lat()).orElse(null),
                            hit.map(h -> h.coordinates().lng()).orElse(null),
                            hit.map(KakaoLocalClient.Hit::resolvedAs).orElse(null))
                    .update();
            return hit.map(KakaoLocalClient.Hit::coordinates);
        } catch (RuntimeException e) {
            log.warn("[geocode] '{}' 좌표를 찾지 못했습니다(다음 수집 때 다시 시도): {}", query, e.toString());
            return Optional.empty();
        }
    }
}
