package dev.imjaewoo.gonggo.ingestion;

import dev.imjaewoo.gonggo.announcement.AnnouncementUpserter;
import dev.imjaewoo.gonggo.announcement.AnnouncementUpserter.Outcome;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * 수집 실행: 가져오기 → 원본 저장 → 정규화 → 저장(변경 감지) → 실행 기록.
 * 실행 자체는 트랜잭션으로 묶지 않는다. 공고 한 건씩 커밋하므로 중간에 실패해도 다시 돌리면 이어진다.
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);
    private static final int MAX_ERROR_DETAILS = 5;

    private final Map<String, SourceAdapter> adapters;
    private final AnnouncementUpserter upserter;
    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final Clock clock;
    /** 같은 출처가 동시에 두 번 돌지 않게 한다(서버 1대 전제. 여러 대면 DB advisory lock으로 바꾼다) */
    private final Set<String> running = ConcurrentHashMap.newKeySet();

    public IngestionService(List<SourceAdapter> adapters, AnnouncementUpserter upserter, JdbcClient jdbc,
            JsonMapper json, Clock clock) {
        this.adapters = adapters.stream().collect(Collectors.toMap(SourceAdapter::sourceId, Function.identity()));
        this.upserter = upserter;
        this.jdbc = jdbc;
        this.json = json;
        this.clock = clock;
    }

    public Optional<SourceAdapter> adapter(String sourceId) {
        return Optional.ofNullable(adapters.get(sourceId));
    }

    public List<SourceAdapter> scheduledAdapters() {
        return adapters.values().stream().filter(a -> a.enabled() && a.scheduled()).toList();
    }

    /** @return 실행 기록. 이미 실행 중이면 empty */
    public Optional<IngestionRunView> run(SourceAdapter adapter, String trigger) {
        if (!running.add(adapter.sourceId())) {
            log.info("[ingestion] {} 이미 실행 중이라 건너뜀", adapter.sourceId());
            return Optional.empty();
        }
        try {
            return Optional.of(execute(adapter, trigger));
        } finally {
            running.remove(adapter.sourceId());
        }
    }

    private IngestionRunView execute(SourceAdapter adapter, String trigger) {
        Instant started = clock.instant();
        long runId = jdbc.sql("""
                insert into ingestion_runs (source_id, trigger, status, started_at)
                values (?, ?, 'running', ?) returning id""")
                .params(adapter.sourceId(), trigger, Timestamp.from(started))
                .query(Long.class).single();

        Map<Outcome, Integer> counts = new EnumMap<>(Outcome.class);
        int fetched = 0;
        int errors = 0;
        List<String> details = new ArrayList<>();
        String status = "succeeded";
        try {
            List<SourceRecord> records = adapter.fetch();
            fetched = records.size();
            adapter.validate(records);
            for (SourceRecord record : records) {
                saveRaw(adapter.sourceId(), record);
                try {
                    Outcome outcome = upserter.upsert(adapter.normalize(record, clock.instant()), clock.instant());
                    counts.merge(outcome, 1, Integer::sum);
                } catch (RuntimeException e) {
                    errors++;
                    if (details.size() < MAX_ERROR_DETAILS) {
                        details.add(record.externalId() + ": " + e.getMessage());
                    }
                    log.warn("[ingestion] {} {} 처리 실패: {}", adapter.sourceId(), record.externalId(), e.toString());
                }
            }
            // 빈 응답은 출처 장애일 수 있어 전부 마감시키지 않는다
            if (adapter.fullSnapshot() && !records.isEmpty()) {
                Set<String> seen = records.stream().map(SourceRecord::externalId).collect(Collectors.toSet());
                int closed = upserter.closeMissing(adapter.sourceId(), seen, clock.instant());
                counts.merge(Outcome.CHANGED, closed, Integer::sum);
                if (closed > 0) {
                    log.info("[ingestion] {} 목록에서 내려간 공고 {}건 마감 처리", adapter.sourceId(), closed);
                }
            }
        } catch (RuntimeException e) {
            status = "failed";
            details.addFirst(e.getMessage());
            log.error("[ingestion] {} 실행 실패", adapter.sourceId(), e);
        }

        String message = details.isEmpty() ? null : String.join("\n", details);
        if (message != null && message.length() > 4000) {
            message = message.substring(0, 4000);
        }
        jdbc.sql("""
                update ingestion_runs set status = ?, finished_at = ?, fetched_count = ?, created_count = ?,
                    changed_count = ?, unchanged_count = ?, error_count = ?, error_message = ?
                where id = ?""")
                .params(status, Timestamp.from(clock.instant()), fetched, counts.getOrDefault(Outcome.CREATED, 0),
                        counts.getOrDefault(Outcome.CHANGED, 0), counts.getOrDefault(Outcome.UNCHANGED, 0), errors,
                        message, runId)
                .update();
        log.info("[ingestion] {} {} — 가져옴 {}, 신규 {}, 변경 {}, 그대로 {}, 오류 {}", adapter.sourceId(), status, fetched,
                counts.getOrDefault(Outcome.CREATED, 0), counts.getOrDefault(Outcome.CHANGED, 0),
                counts.getOrDefault(Outcome.UNCHANGED, 0), errors);
        return recentRuns(1).getFirst();
    }

    /** 같은 원본은 다시 쌓지 않는다 */
    private void saveRaw(String sourceId, SourceRecord record) {
        String payload = json.writeValueAsString(record.payload());
        jdbc.sql("""
                insert into raw_records (source_id, external_id, payload, payload_hash, fetched_at)
                values (?, ?, ?::jsonb, ?, ?)
                on conflict (source_id, external_id, payload_hash) do nothing""")
                .params(sourceId, record.externalId(), payload, sha256(payload), Timestamp.from(clock.instant()))
                .update();
    }

    public List<IngestionRunView> recentRuns(int limit) {
        return jdbc.sql("""
                select id, source_id, trigger, status, started_at, finished_at, fetched_count, created_count,
                       changed_count, unchanged_count, error_count, error_message
                from ingestion_runs order by id desc limit ?""")
                .param(limit)
                .query((rs, i) -> new IngestionRunView(rs.getLong("id"), rs.getString("source_id"),
                        rs.getString("trigger"), rs.getString("status"), rs.getTimestamp("started_at").toInstant(),
                        Optional.ofNullable(rs.getTimestamp("finished_at")).map(Timestamp::toInstant).orElse(null),
                        rs.getInt("fetched_count"), rs.getInt("created_count"), rs.getInt("changed_count"),
                        rs.getInt("unchanged_count"), rs.getInt("error_count"), rs.getString("error_message")))
                .list();
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
