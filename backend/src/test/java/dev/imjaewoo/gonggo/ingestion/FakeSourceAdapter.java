package dev.imjaewoo.gonggo.ingestion;

import dev.imjaewoo.gonggo.announcement.Incoming;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/** 테스트에서 응답을 마음대로 바꿀 수 있는 출처 */
public class FakeSourceAdapter implements SourceAdapter {

    public static final String ID = "fake";

    /** externalId → 그 건을 만드는 함수. 함수가 예외를 던지면 정규화 실패로 센다 */
    public final Map<String, Function<Instant, Incoming>> items = new ConcurrentHashMap<>();
    public volatile RuntimeException fetchFailure;
    /** true면 응답에 없는 기존 공고를 마감 처리하는 출처처럼 동작한다 */
    public volatile boolean snapshot;

    @Override
    public String sourceId() {
        return ID;
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public boolean scheduled() {
        return false;
    }

    @Override
    public boolean fullSnapshot() {
        return snapshot;
    }

    @Override
    public List<SourceRecord> fetch() {
        if (fetchFailure != null) {
            throw fetchFailure;
        }
        List<SourceRecord> records = new ArrayList<>();
        items.keySet().stream().sorted().forEach(id -> records.add(new SourceRecord(id,
                tools.jackson.databind.node.JsonNodeFactory.instance.objectNode().put("id", id))));
        return records;
    }

    @Override
    public Incoming normalize(SourceRecord record, Instant now) {
        return items.get(record.externalId()).apply(now);
    }
}
