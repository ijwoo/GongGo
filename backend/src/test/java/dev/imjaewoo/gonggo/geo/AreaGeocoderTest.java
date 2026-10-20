package dev.imjaewoo.gonggo.geo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import com.sun.net.httpserver.HttpServer;
import dev.imjaewoo.gonggo.IntegrationTest;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.node.JsonNodeFactory;

/** 카카오 로컬 API를 흉내 낸 서버로 지오코딩·캐시·실패 처리를 확인한다. 키가 있으면 카카오 로그인도 켜진다 */
class AreaGeocoderTest extends IntegrationTest {

    static final List<String> queries = new CopyOnWriteArrayList<>();
    static volatile boolean failing;
    static final HttpServer kakao = start();

    static HttpServer start() {
        try {
            HttpServer s = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            s.createContext("/v2/local/search/", ex -> {
                String q = URLDecoder.decode(ex.getRequestURI().getRawQuery().replaceAll(".*query=", ""),
                        StandardCharsets.UTF_8);
                queries.add(ex.getRequestURI().getPath() + "?" + q);
                String auth = ex.getRequestHeaders().getFirst("Authorization");
                String body;
                int status = 200;
                if (failing) {
                    status = 500;
                    body = "{}";
                } else if (!"KakaoAK test-rest-key".equals(auth)) {
                    status = 401;
                    body = "{}";
                } else if (q.equals("서울 강남구") || q.equals("경기 성남시")) {
                    body = "{\"documents\":[{\"address_name\":\"" + q + "\",\"x\":\"127.0473\",\"y\":\"37.5172\"}]}";
                } else {
                    body = "{\"documents\":[]}";
                }
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                ex.sendResponseHeaders(status, bytes.length);
                ex.getResponseBody().write(bytes);
                ex.close();
            });
            s.start();
            return s;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void kakaoProps(DynamicPropertyRegistry r) {
        r.add("gonggo.kakao.rest-api-key", () -> "test-rest-key");
        r.add("gonggo.kakao.local-api-url", () -> "http://localhost:" + kakao.getAddress().getPort());
    }

    @AfterAll
    static void stop() {
        kakao.stop(0);
    }

    @Autowired AreaGeocoder geocoder;
    @Autowired JdbcClient jdbc;
    @Autowired MockMvc mvc;

    @BeforeEach
    void setUp() {
        queries.clear();
        failing = false;
        jdbc.sql("delete from geocode_cache").update();
    }

    @Test
    void 구_단위_지역에_대략_좌표를_붙이고_결과를_캐시한다() {
        AnnouncementContent first = geocoder.enrich(content("서울 강남구"));
        AnnouncementContent second = geocoder.enrich(content("서울 강남구"));

        Venue.Tbd venue = (Venue.Tbd) first.venue();
        assertThat(venue.area().coordinates()).isEqualTo(new Venue.Coordinates(37.5172, 127.0473));
        assertThat(venue.note()).isEqualTo("원문 확인");
        assertThat(second.venue()).isEqualTo(first.venue());
        assertThat(queries).hasSize(1); // 두 번째는 캐시
    }

    @Test
    void 시_이름이_빠진_지역은_시를_붙여_다시_찾고_못_찾으면_좌표_없이_둔다() {
        assertThat(((Venue.Tbd) geocoder.enrich(content("경기 성남")).venue()).area().coordinates()).isNotNull();
        assertThat(((Venue.Tbd) geocoder.enrich(content("어딘가")).venue()).area().coordinates()).isNull();
        geocoder.enrich(content("어딘가"));
        // 못 찾은 결과도 캐시해 같은 지역을 반복해서 묻지 않는다
        assertThat(queries.stream().filter(q -> q.endsWith("어딘가")).count()).isEqualTo(2); // 주소 + 키워드 한 번씩
    }

    @Test
    void API_오류는_캐시하지_않고_수집을_막지_않는다() {
        failing = true;
        assertThat(((Venue.Tbd) geocoder.enrich(content("서울 강남구")).venue()).area().coordinates()).isNull();
        failing = false;
        assertThat(((Venue.Tbd) geocoder.enrich(content("서울 강남구")).venue()).area().coordinates()).isNotNull();
    }

    @Test
    void 키가_있으면_카카오_로그인이_켜진다() throws Exception {
        mvc.perform(get("/api/auth/session")).andExpect(jsonPath("$.kakaoEnabled").value(true));
        mvc.perform(get("/oauth2/authorization/kakao").header("X-Forwarded-Host", "13.124.30.241:3000")
                        .header("X-Forwarded-Proto", "http"))
                .andExpect(r -> {
                    String location = r.getResponse().getHeader("Location");
                    assertThat(location).startsWith("https://kauth.kakao.com/oauth/authorize")
                            .contains("client_id=test-rest-key")
                            // 카카오가 돌려보낼 주소는 웹 주소 기준(프록시 헤더)이어야 한다
                            .contains("redirect_uri=http://13.124.30.241:3000/login/oauth2/code/kakao");
                });
    }

    private static AnnouncementContent content(String area) {
        return new AnnouncementContent("x", "행사", new Organizer("기관", null, "#000000"), "event", "devevent",
                "https://example.com", "Dev-Event", Instant.EPOCH, Instant.EPOCH, new ApplicationStart.Tbd(),
                new Deadline.Tbd(), new EventSchedule.Tbd(), "offline",
                new Venue.Tbd("원문 확인", new Venue.Area(area, null)), List.of(), null, null, null,
                JsonNodeFactory.instance.arrayNode(), List.of(), List.of(), "active");
    }
}
