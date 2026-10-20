package dev.imjaewoo.gonggo.ingestion;

import dev.imjaewoo.gonggo.announcement.Incoming;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** 출처 하나. 가져오기(fetch)와 정규화(normalize)를 나눠 원본을 먼저 남긴다 */
public interface SourceAdapter {

    String sourceId();

    /** 설정(API 키 등)이 없으면 false. 꺼진 출처는 수동 실행도 거절한다 */
    boolean enabled();

    /** 정기 수집에 포함할지 */
    boolean scheduled();

    /**
     * fetch가 지금 열려 있는 공고 전부를 돌려주는지(채용 게시판처럼 마감되면 목록에서 내려가는 출처).
     * true면 실행이 성공했을 때 이번 응답에 없는 기존 공고를 마감(cancelled) 처리한다.
     */
    default boolean fullSnapshot() {
        return false;
    }

    /** 원문 페이지에 대표 이미지가 없을 때 대신 찾아볼 주소(예: 회사 홈페이지). 없으면 empty */
    default Optional<String> previewFallbackUrl(String organizerName) {
        return Optional.empty();
    }

    List<SourceRecord> fetch();

    /** 응답 전체를 보고 매핑이 맞는지 검사한다. 틀리면 예외 → 그 실행은 failed */
    default void validate(List<SourceRecord> records) {
    }

    /** 한 건 정규화. 실패하면 그 건만 오류로 센다 */
    Incoming normalize(SourceRecord record, Instant now);
}
