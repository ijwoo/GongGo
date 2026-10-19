package dev.imjaewoo.gonggo.announcement;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnouncementRevisionRepository extends JpaRepository<AnnouncementRevision, String> {

    List<AnnouncementRevision> findByAnnouncementIdInOrderByVersionAscIdAsc(Collection<String> announcementIds);
}
