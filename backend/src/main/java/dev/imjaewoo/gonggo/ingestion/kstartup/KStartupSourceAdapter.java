package dev.imjaewoo.gonggo.ingestion.kstartup;

import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 공공데이터포털 '창업진흥원_K-Startup 사업공고 조회'. KSTARTUP_SERVICE_KEY가 있을 때만 켜진다.
 * 페이지를 넘기며 가져오고, 한 번에 maxPages까지만 읽는다(호출 한도 보호).
 */
@Component
public class KStartupSourceAdapter implements SourceAdapter {

    private final KStartupProperties props;
    private final KStartupNormalizer normalizer;
    private final JsonMapper json;
    private final RestClient http;

    public KStartupSourceAdapter(KStartupProperties props, JsonMapper json) {
        this.props = props;
        this.json = json;
        this.normalizer = new KStartupNormalizer(props, json);
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public String sourceId() {
        return KStartupNormalizer.SOURCE_ID;
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
    public List<SourceRecord> fetch() {
        List<SourceRecord> records = new ArrayList<>();
        int pageSize = props.pageSize() != null ? props.pageSize() : 100;
        int maxPages = props.maxPages() != null ? props.maxPages() : 5;
        for (int page = 1; page <= maxPages; page++) {
            String body = http.get().uri(uri(page, pageSize)).retrieve().body(String.class);
            JsonNode items = json.readTree(body).at(props.itemsPointer());
            if (!items.isArray()) {
                throw new IllegalStateException("K-Startup 응답에서 공고 목록(" + props.itemsPointer()
                        + ")을 찾지 못했습니다. 응답 앞부분: " + abbreviate(body));
            }
            for (JsonNode item : items) {
                String id = normalizer.externalId(item);
                records.add(new SourceRecord(id != null ? id : "unknown-" + records.size(), item));
            }
            if (items.size() < pageSize) {
                break;
            }
        }
        return records;
    }

    @Override
    public void validate(List<SourceRecord> records) {
        normalizer.validate(records);
    }

    @Override
    public Incoming normalize(SourceRecord record, Instant now) {
        return normalizer.normalize(record, now);
    }

    /** 공공데이터포털 키는 이미 인코딩된 형태로 발급되기도 해서, '%'가 있으면 그대로 쓴다 */
    private URI uri(int page, int pageSize) {
        Map<String, String> query = new LinkedHashMap<>();
        query.put("serviceKey", props.serviceKey());
        if (props.params() != null) {
            query.putAll(props.params());
        }
        query.put(props.pageParam(), String.valueOf(page));
        query.put(props.sizeParam(), String.valueOf(pageSize));
        String qs = query.entrySet().stream()
                .map(e -> encode(e.getKey()) + "=" + ("serviceKey".equals(e.getKey()) && e.getValue().contains("%")
                        ? e.getValue() : encode(e.getValue())))
                .collect(Collectors.joining("&"));
        return URI.create(props.endpoint() + "?" + qs);
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String abbreviate(String s) {
        return s == null ? "(빈 응답)" : s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
