package dev.imjaewoo.gonggo.announcement.model;

import java.time.Instant;

/** 웹 announcementRevisionSchema */
public record AnnouncementRevisionView(
        String id, int version, Instant changedAt, String kind, String summary, String before, String after) {
}
