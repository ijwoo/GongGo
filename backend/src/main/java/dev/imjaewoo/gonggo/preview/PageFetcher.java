package dev.imjaewoo.gonggo.preview;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 공고 원문 페이지의 HTML 앞부분을 읽는다. 주소는 커뮤니티 목록(README)에서 오므로 믿지 않는다.
 * - http(s)·기본 포트만, 사설·루프백·링크 로컬(클라우드 메타데이터 169.254.x 포함) 주소는 거절
 * - 리다이렉트는 직접 따라가며 매번 같은 검사를 한다(최대 4번)
 * - HTML이 아니면 읽지 않고, 512KB까지만 읽는다(대표 이미지 태그는 head에 있다)
 */
@Component
public class PageFetcher {

    static final int MAX_BYTES = 512 * 1024;
    private static final int MAX_REDIRECTS = 4;
    private static final String USER_AGENT = "Mozilla/5.0 (compatible; GonggohamBot/1.0; +link preview)";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public record Page(URI finalUrl, String html) {
    }

    public Optional<Page> fetch(URI url) {
        URI current = url;
        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                if (!allowed(current)) {
                    return Optional.empty();
                }
                HttpRequest req = HttpRequest.newBuilder(current).timeout(Duration.ofSeconds(6))
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "text/html,application/xhtml+xml")
                        .GET().build();
                HttpResponse<InputStream> res = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
                try (InputStream body = res.body()) {
                    int code = res.statusCode();
                    if (code >= 300 && code < 400) {
                        Optional<String> location = res.headers().firstValue("location");
                        if (location.isEmpty()) {
                            return Optional.empty();
                        }
                        current = current.resolve(location.get().strip());
                        continue;
                    }
                    String type = res.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
                    if (code != 200 || !(type.isEmpty() || type.contains("html"))) {
                        return Optional.empty();
                    }
                    return Optional.of(new Page(current, new String(body.readNBytes(MAX_BYTES), StandardCharsets.UTF_8)));
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
        return Optional.empty();
    }

    /** 외부 공개 주소인지. DNS가 여러 주소를 주면 하나라도 내부 주소면 거절한다 */
    static boolean allowed(URI url) {
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase(Locale.ROOT);
        if (!(scheme.equals("http") || scheme.equals("https")) || url.getHost() == null || url.getUserInfo() != null) {
            return false;
        }
        int port = url.getPort();
        if (port != -1 && port != 80 && port != 443) {
            return false;
        }
        try {
            for (InetAddress addr : InetAddress.getAllByName(url.getHost())) {
                if (internal(addr)) {
                    return false;
                }
            }
            return true;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    static boolean internal(InetAddress addr) {
        if (addr.isAnyLocalAddress() || addr.isLoopbackAddress() || addr.isLinkLocalAddress()
                || addr.isSiteLocalAddress() || addr.isMulticastAddress()) {
            return true;
        }
        byte[] b = addr.getAddress();
        if (addr instanceof Inet6Address) {
            return (b[0] & 0xfe) == 0xfc; // fc00::/7 고유 로컬
        }
        int first = b[0] & 0xff;
        int second = b[1] & 0xff;
        return first == 0 || (first == 100 && second >= 64 && second <= 127); // 0/8, 100.64/10(CGNAT)
    }
}
