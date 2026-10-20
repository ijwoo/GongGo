package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementRevisionView;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AnnouncementQueryService {

    private final AnnouncementRepository announcements;
    private final AnnouncementRevisionRepository revisions;
    private final AnnouncementMapper mapper;
    private final AnnouncementImageStore images;

    public AnnouncementQueryService(AnnouncementRepository announcements, AnnouncementRevisionRepository revisions,
            AnnouncementMapper mapper, AnnouncementImageStore images) {
        this.announcements = announcements;
        this.revisions = revisions;
        this.mapper = mapper;
        this.images = images;
    }

    public record Result(List<AnnouncementView> items, long total) {
    }

    public Result search(AnnouncementSearch search, int page, int size, Instant now) {
        Page<Announcement> found = announcements.findAll(AnnouncementSpecs.matching(search, now),
                PageRequest.of(page, size));
        return new Result(withRevisions(found.getContent()), found.getTotalElements());
    }

    public Optional<AnnouncementView> find(String id) {
        return announcements.findById(id).map(a -> withRevisions(List.of(a)).getFirst());
    }

    /** 이력·대표 이미지는 한 번에 모아 읽는다(공고마다 따로 읽지 않는다) */
    private List<AnnouncementView> withRevisions(List<Announcement> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        Map<String, List<AnnouncementRevisionView>> byId = revisions
                .findByAnnouncementIdInOrderByVersionAscIdAsc(list.stream().map(Announcement::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(AnnouncementRevision::getAnnouncementId,
                        Collectors.mapping(AnnouncementRevision::toView, Collectors.toList())));
        var imageById = images.find(list.stream().map(Announcement::getId).toList());
        return list.stream()
                .map(a -> mapper.toView(a, byId.getOrDefault(a.getId(), List.of()), imageById.get(a.getId())))
                .toList();
    }
}
