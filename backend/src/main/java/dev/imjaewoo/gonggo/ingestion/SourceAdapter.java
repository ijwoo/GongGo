package dev.imjaewoo.gonggo.ingestion;

import dev.imjaewoo.gonggo.announcement.Incoming;
import java.time.Instant;
import java.util.List;

/** 출처 하나. 가져오기(fetch)와 정규화(normalize)를 나눠 원본을 먼저 남긴다 */
public interface SourceAdapter {

    String sourceId();

    /** 설정(API 키 등)이 없으면 false. 꺼진 출처는 수동 실행도 거절한다 */
    boolean enabled();

    /** 정기 수집에 포함할지 */
    boolean scheduled();

    List<SourceRecord> fetch();

    /** 응답 전체를 보고 매핑이 맞는지 검사한다. 틀리면 예외 → 그 실행은 failed */
    default void validate(List<SourceRecord> records) {
    }

    /** 한 건 정규화. 실패하면 그 건만 오류로 센다 */
    Incoming normalize(SourceRecord record, Instant now);
}
