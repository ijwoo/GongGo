package dev.imjaewoo.gonggo.api;

import dev.imjaewoo.gonggo.announcement.AnnouncementQueryService;
import dev.imjaewoo.gonggo.announcement.AnnouncementSearch;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementView;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/announcements")
class AnnouncementController {

    static final int MAX_SIZE = 500;

    private final AnnouncementQueryService service;
    private final Clock clock;

    AnnouncementController(AnnouncementQueryService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    /** serverTime: 마감 판정에 쓴 기준 시각. 웹은 이 값으로 화면 전체의 날짜를 맞춘다 */
    record PageResponse(List<AnnouncementView> items, int page, int size, long total, Instant serverTime) {
    }

    @GetMapping
    PageResponse list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cat,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String mode,
            @RequestParam(defaultValue = "false") boolean includeClosed,
            @RequestParam(required = false) Integer closedWithinDays,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        if (page < 0 || size < 1 || size > MAX_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "page는 0 이상, size는 1~" + MAX_SIZE + " 사이여야 합니다.");
        }
        if (closedWithinDays != null && (closedWithinDays < 1 || closedWithinDays > 3650)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "closedWithinDays는 1~3650 사이여야 합니다.");
        }
        if (q != null && q.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 80자까지입니다.");
        }
        Instant now = clock.instant();
        var result = service.search(AnnouncementSearch.of(q, cat, region, mode, includeClosed, closedWithinDays, sort), page, size, now);
        return new PageResponse(result.items(), page, size, result.total(), now);
    }

    @GetMapping("/{id}")
    AnnouncementView get(@PathVariable String id) {
        return service.find(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공고를 찾을 수 없습니다."));
    }
}
