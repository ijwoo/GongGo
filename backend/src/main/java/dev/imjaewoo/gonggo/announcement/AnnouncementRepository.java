package dev.imjaewoo.gonggo.announcement;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AnnouncementRepository
        extends JpaRepository<Announcement, String>, JpaSpecificationExecutor<Announcement> {

    Optional<Announcement> findBySourceIdAndExternalId(String sourceId, String externalId);

    long countBySourceId(String sourceId);

    List<Announcement> findBySourceIdAndStatus(String sourceId, String status);
}
