package dev.imjaewoo.gonggo.announcement.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 공고 대표 이미지. 웹 announcementSchema.image와 같다. poster는 글자·로고가 중요해 자르지 않고 보여 준다 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnnouncementImage(String url, String kind, String alt) {
}
