package dev.imjaewoo.gonggo.announcement;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementRevisionView;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 사용자에게 알려야 하는 공고 변경 한 건(마감·장소·조건·취소) */
@Entity
@Table(name = "announcement_revisions")
public class AnnouncementRevision {

    @Id
    private String id;

    private String announcementId;
    private int version;
    private String kind;
    private String summary;

    @Column(name = "before_text")
    private String before;

    @Column(name = "after_text")
    private String after;

    private Instant changedAt;

    protected AnnouncementRevision() {
    }

    public AnnouncementRevision(String id, String announcementId, int version, String kind, String summary,
            String before, String after, Instant changedAt) {
        this.id = id;
        this.announcementId = announcementId;
        this.version = version;
        this.kind = kind;
        this.summary = summary;
        this.before = before;
        this.after = after;
        this.changedAt = changedAt;
    }

    public String getAnnouncementId() { return announcementId; }
    public String getKind() { return kind; }
    public int getVersion() { return version; }

    public AnnouncementRevisionView toView() {
        return new AnnouncementRevisionView(id, version, changedAt, kind, summary, before, after);
    }
}
