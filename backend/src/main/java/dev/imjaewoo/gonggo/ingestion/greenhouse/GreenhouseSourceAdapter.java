package dev.imjaewoo.gonggo.ingestion.greenhouse;

import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 회사별 Greenhouse 채용 게시판. 키 없이 공개된 API라 기본으로 켜져 있다.
 * 게시판 하나라도 못 읽으면 실행 전체를 실패로 둔다. 일부만 읽고 나머지를 마감 처리하면 안 되기 때문이다.
 */
@Component
public class GreenhouseSourceAdapter implements SourceAdapter {

    private final GreenhouseProperties props;
    private final GreenhouseNormalizer normalizer;
    private final JsonMapper json;
    private final RestClient http;

    public GreenhouseSourceAdapter(GreenhouseProperties props, JsonMapper json) {
        this.props = props;
        this.json = json;
        this.normalizer = new GreenhouseNormalizer(props);
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public String sourceId() {
        return GreenhouseNormalizer.SOURCE_ID;
    }

    @Override
    public boolean enabled() {
        return props.configured();
    }

    @Override
    public boolean scheduled() {
        return true;
    }

    @Override
    public boolean fullSnapshot() {
        return true;
    }

    @Override
    public List<SourceRecord> fetch() {
        List<SourceRecord> records = new ArrayList<>();
        for (GreenhouseProperties.Board board : props.boards()) {
            String body = http.get().uri(props.endpoint() + "/{token}/jobs", board.token()).retrieve()
                    .body(String.class);
            JsonNode jobs = json.readTree(body).path("jobs");
            if (!jobs.isArray()) {
                throw new IllegalStateException("Greenhouse " + board.token() + " 응답에 jobs 배열이 없습니다.");
            }
            for (JsonNode job : jobs) {
                if (normalizer.accepts(job)) {
                    ObjectNode payload = ((ObjectNode) job.deepCopy()).put("board", board.token())
                            .put("company", board.name());
                    records.add(new SourceRecord(GreenhouseNormalizer.externalId(board.token(), job), payload));
                }
            }
        }
        return records;
    }

    @Override
    public Optional<String> previewFallbackUrl(String organizerName) {
        return props.boards().stream().filter(b -> b.name().equals(organizerName) && b.homepage() != null)
                .map(GreenhouseProperties.Board::homepage).findFirst();
    }

    @Override
    public Incoming normalize(SourceRecord record, Instant now) {
        return normalizer.normalize(record, now);
    }
}
