package dev.imjaewoo.gonggo.geo;

import dev.imjaewoo.gonggo.announcement.model.Venue;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 카카오 로컬 API(주소·키워드 검색). 결과의 x는 경도, y는 위도다 */
@Component
public class KakaoLocalClient {

    public record Hit(Venue.Coordinates coordinates, String resolvedAs) {
    }

    private final KakaoProperties props;
    private final JsonMapper json;
    private final RestClient http;

    public KakaoLocalClient(KakaoProperties props, JsonMapper json) {
        this.props = props;
        this.json = json;
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    public boolean enabled() {
        return props.hasRestKey();
    }

    public Optional<Hit> searchAddress(String query) {
        return first("/v2/local/search/address.json", query, "address_name");
    }

    public Optional<Hit> searchKeyword(String query) {
        return first("/v2/local/search/keyword.json", query, "place_name");
    }

    private Optional<Hit> first(String path, String query, String nameField) {
        URI uri = URI.create(props.localApiUrlOrDefault() + path + "?size=1&query="
                + URLEncoder.encode(query, StandardCharsets.UTF_8));
        String body = http.get().uri(uri).header("Authorization", "KakaoAK " + props.restApiKey())
                .retrieve().body(String.class);
        JsonNode docs = json.readTree(body).path("documents");
        if (!docs.isArray() || docs.isEmpty()) {
            return Optional.empty();
        }
        JsonNode d = docs.get(0);
        double lng = Double.parseDouble(d.path("x").asString());
        double lat = Double.parseDouble(d.path("y").asString());
        return Optional.of(new Hit(new Venue.Coordinates(lat, lng), d.path(nameField).asString(query)));
    }
}
