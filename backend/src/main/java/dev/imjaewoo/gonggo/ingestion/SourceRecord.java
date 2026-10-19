package dev.imjaewoo.gonggo.ingestion;

import tools.jackson.databind.JsonNode;

/** 출처 응답의 공고 한 건(원본 그대로) */
public record SourceRecord(String externalId, JsonNode payload) {
}
