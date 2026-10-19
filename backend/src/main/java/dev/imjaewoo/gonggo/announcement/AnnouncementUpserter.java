package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공고 한 건을 저장한다. 같은 내용을 여러 번 넣어도 결과가 같다(멱등).
 * 트랜잭션은 한 건 단위라 한 건이 실패해도 나머지는 저장된다.
 */
@Service
public class AnnouncementUpserter {

    public enum Outcome { CREATED, CHANGED, UNCHANGED }

    private final AnnouncementRepository announcements;
    private final AnnouncementRevisionRepository revisions;
    private final AnnouncementMapper mapper;

    public AnnouncementUpserter(AnnouncementRepository announcements, AnnouncementRevisionRepository revisions,
            AnnouncementMapper mapper) {
        this.announcements = announcements;
        this.revisions = revisions;
        this.mapper = mapper;
    }

    @Transactional
    public Outcome upsert(Incoming in, Instant now) {
        AnnouncementContent content = in.content();
        String hash = mapper.hash(content);
        var existing = announcements.findBySourceIdAndExternalId(content.sourceId(), in.externalId());

        if (existing.isEmpty()) {
            Announcement a = new Announcement(content.id(), content.sourceId(), in.externalId(), now);
            mapper.apply(content, a);
            a.markContent(in.initialVersion(), hash, now);
            a.markChecked(in.checkedAt());
            announcements.save(a);
            revisions.saveAll(in.history().stream()
                    .map(r -> new AnnouncementRevision(r.id(), a.getId(), r.version(), r.kind(), r.summary(),
                            r.before(), r.after(), r.changedAt()))
                    .toList());
            return Outcome.CREATED;
        }

        Announcement a = existing.get();
        a.markChecked(in.checkedAt());
        if (hash.equals(a.getContentHash())) {
            return Outcome.UNCHANGED;
        }
        List<RevisionDetector.Change> changes = RevisionDetector.detect(mapper.toContent(a), content);
        int version = changes.isEmpty() ? a.getContentVersion() : a.getContentVersion() + 1;
        mapper.apply(content, a);
        a.markContent(version, hash, now);
        revisions.saveAll(changes.stream()
                .map(c -> new AnnouncementRevision(a.getId() + "-v" + version + "-" + c.kind(), a.getId(), version,
                        c.kind(), c.summary(), c.before(), c.after(), now))
                .toList());
        return Outcome.CHANGED;
    }
}
