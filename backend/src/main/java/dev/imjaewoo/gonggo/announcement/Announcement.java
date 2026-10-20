package dev.imjaewoo.gonggo.announcement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import dev.imjaewoo.gonggo.common.Seoul;
import org.hibernate.annotations.ColumnTransformer;

/**
 * 공고 한 건. 검색·정렬에 쓰는 값은 열로, 모양이 다양한 값은 jsonb 문자열로 둔다.
 * 값의 조립·해체는 {@link AnnouncementMapper}가 맡고, 이 클래스는 저장 모양만 안다.
 */
@Entity
@Table(name = "announcements")
public class Announcement {

    @Id
    private String id;

    private String sourceId;
    private String externalId;
    private String title;
    private String organizerName;
    private String organizerAddress;
    private String organizerColor;
    private String category;
    private String participationMode;
    private String status;
    private String sourceUrl;
    private String sourceName;
    private Instant publishedAt;
    private Instant sourceUpdatedAt;
    private Instant lastCheckedAt;

    private String appStartType;
    private Instant appStartAt;
    private LocalDate appStartDate;

    private String deadlineType;
    private Instant deadlineAt;
    private LocalDate deadlineDate;
    private String deadlineNote;
    private Instant deadlineSortAt;

    private String eventType;
    private Instant eventStartAt;
    private Instant eventEndAt;
    private LocalDate eventStartDate;
    private LocalDate eventEndDate;

    private String venueStatus;
    private String venueName;
    private String venueAddress;
    private String venueDistrict;
    private Double venueLat;
    private Double venueLng;
    private String venueNote;
    private String venuePlatform;
    private String venueArea;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String eligibilityRegions;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String teamSize;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String cost;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String supportAmount;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String conditions;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String requiredDocuments;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String checkPoints;

    private int contentVersion;
    private String contentHash;
    private Instant createdAt;
    private Instant updatedAt;

    protected Announcement() {
    }

    Announcement(String id, String sourceId, String externalId, Instant now) {
        this.id = id;
        this.sourceId = sourceId;
        this.externalId = externalId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public String getId() { return id; }
    public String getSourceId() { return sourceId; }
    public String getExternalId() { return externalId; }
    public String getTitle() { return title; }
    public String getOrganizerName() { return organizerName; }
    public String getOrganizerAddress() { return organizerAddress; }
    public String getOrganizerColor() { return organizerColor; }
    public String getCategory() { return category; }
    public String getParticipationMode() { return participationMode; }
    public String getStatus() { return status; }
    public String getSourceUrl() { return sourceUrl; }
    public String getSourceName() { return sourceName; }
    public Instant getPublishedAt() { return publishedAt; }
    public Instant getSourceUpdatedAt() { return sourceUpdatedAt; }
    public Instant getLastCheckedAt() { return lastCheckedAt; }
    public String getAppStartType() { return appStartType; }
    public Instant getAppStartAt() { return appStartAt; }
    public LocalDate getAppStartDate() { return appStartDate; }
    public String getDeadlineType() { return deadlineType; }
    public Instant getDeadlineAt() { return deadlineAt; }
    public LocalDate getDeadlineDate() { return deadlineDate; }
    public String getDeadlineNote() { return deadlineNote; }
    public String getEventType() { return eventType; }
    public Instant getEventStartAt() { return eventStartAt; }
    public Instant getEventEndAt() { return eventEndAt; }
    public LocalDate getEventStartDate() { return eventStartDate; }
    public LocalDate getEventEndDate() { return eventEndDate; }
    public String getVenueStatus() { return venueStatus; }
    public String getVenueName() { return venueName; }
    public String getVenueAddress() { return venueAddress; }
    public String getVenueDistrict() { return venueDistrict; }
    public Double getVenueLat() { return venueLat; }
    public Double getVenueLng() { return venueLng; }
    public String getVenueNote() { return venueNote; }
    public String getVenuePlatform() { return venuePlatform; }
    public String getVenueArea() { return venueArea; }
    public String getEligibilityRegions() { return eligibilityRegions; }
    public String getTeamSize() { return teamSize; }
    public String getCost() { return cost; }
    public String getSupportAmount() { return supportAmount; }
    public String getConditions() { return conditions; }
    public String getRequiredDocuments() { return requiredDocuments; }
    public String getCheckPoints() { return checkPoints; }
    public int getContentVersion() { return contentVersion; }
    public String getContentHash() { return contentHash; }

    void setBasics(String title, String organizerName, String organizerAddress, String organizerColor, String category,
            String participationMode, String status, String sourceUrl, String sourceName, Instant publishedAt,
            Instant sourceUpdatedAt) {
        this.title = title;
        this.organizerName = organizerName;
        this.organizerAddress = organizerAddress;
        this.organizerColor = organizerColor;
        this.category = category;
        this.participationMode = participationMode;
        this.status = status;
        this.sourceUrl = sourceUrl;
        this.sourceName = sourceName;
        this.publishedAt = publishedAt;
        this.sourceUpdatedAt = sourceUpdatedAt;
    }

    void setApplicationStart(String type, Instant at, LocalDate date) {
        this.appStartType = type;
        this.appStartAt = at;
        this.appStartDate = date;
    }

    void setDeadline(String type, Instant at, LocalDate date, String note) {
        this.deadlineType = type;
        this.deadlineAt = at;
        this.deadlineDate = date;
        this.deadlineNote = note;
        this.deadlineSortAt = at != null ? at
                : date != null ? date.plusDays(1).atStartOfDay(Seoul.ZONE).toInstant().minusNanos(1_000) : null;
    }

    void setEvent(String type, Instant startAt, Instant endAt, LocalDate startDate, LocalDate endDate) {
        this.eventType = type;
        this.eventStartAt = startAt;
        this.eventEndAt = endAt;
        this.eventStartDate = startDate;
        this.eventEndDate = endDate;
    }

    void setVenue(String status, String name, String address, String district, Double lat, Double lng, String note,
            String platform, String area) {
        this.venueArea = area;
        this.venueStatus = status;
        this.venueName = name;
        this.venueAddress = address;
        this.venueDistrict = district;
        this.venueLat = lat;
        this.venueLng = lng;
        this.venueNote = note;
        this.venuePlatform = platform;
    }

    void setJson(String eligibilityRegions, String teamSize, String cost, String supportAmount, String conditions,
            String requiredDocuments, String checkPoints) {
        this.eligibilityRegions = eligibilityRegions;
        this.teamSize = teamSize;
        this.cost = cost;
        this.supportAmount = supportAmount;
        this.conditions = conditions;
        this.requiredDocuments = requiredDocuments;
        this.checkPoints = checkPoints;
    }

    void markContent(int version, String hash, Instant now) {
        this.contentVersion = version;
        this.contentHash = hash;
        this.updatedAt = now;
    }

    void markChecked(Instant checkedAt) {
        this.lastCheckedAt = checkedAt;
    }
}
