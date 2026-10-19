package dev.imjaewoo.gonggo.ingestion.devevent;

import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/**
 * Dev-Event(github.com/brave-people/Dev-Event) README. 키 없이 받을 수 있어 기본으로 켜져 있다.
 * 지난 달은 README에서 지워지지만 행사는 마감일로 자연히 닫히므로 목록에서 빠진 건 마감 처리하지 않는다.
 */
@Component
public class DevEventSourceAdapter implements SourceAdapter {

    private final boolean enabled;
    private final String url;
    private final DevEventParser parser;
    private final DevEventNormalizer normalizer;
    private final RestClient http;

    public DevEventSourceAdapter(JsonMapper json, @Value("${gonggo.devevent.enabled:true}") boolean enabled,
            @Value("${gonggo.devevent.url}") String url) {
        this.enabled = enabled;
        this.url = url;
        this.parser = new DevEventParser(json);
        this.normalizer = new DevEventNormalizer(json);
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public String sourceId() {
        return DevEventNormalizer.SOURCE_ID;
    }

    @Override
    public boolean enabled() {
        return enabled;
    }

    @Override
    public boolean scheduled() {
        return true;
    }

    @Override
    public List<SourceRecord> fetch() {
        String markdown = http.get().uri(url).retrieve().body(String.class);
        List<SourceRecord> records = parser.parse(markdown == null ? "" : markdown);
        if (records.isEmpty()) {
            throw new IllegalStateException("Dev-Event README에서 행사를 하나도 찾지 못했습니다. 형식이 바뀌었는지 확인하세요.");
        }
        return records;
    }

    @Override
    public Incoming normalize(SourceRecord record, Instant now) {
        return normalizer.normalize(record, now);
    }
}
