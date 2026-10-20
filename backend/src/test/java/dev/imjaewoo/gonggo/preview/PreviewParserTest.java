package dev.imjaewoo.gonggo.preview;

import static org.assertj.core.api.Assertions.assertThat;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementImage;
import java.net.InetAddress;
import java.net.URI;
import org.junit.jupiter.api.Test;

class PreviewParserTest {

    private static final URI BASE = URI.create("https://event-us.kr/acme/event/1");

    @Test
    void og_image가_있으면_그것을_사진으로_쓴다() {
        String html = """
                <head><meta name="twitter:image" content="https://cdn.example.com/tw.png">
                <meta content="https://cdn.example.com/cover.png?fit=640%2C360&amp;q=1" property="og:image" /></head>""";
        assertThat(PreviewParser.parse(html, BASE)).contains(
                new AnnouncementImage("https://cdn.example.com/cover.png?fit=640%2C360&q=1", "photo", null));
    }

    @Test
    void og_image가_없으면_twitter_image_그다음_앱_아이콘을_쓴다() {
        assertThat(PreviewParser.parse("<meta name='twitter:image' content='/img/tw.jpg'>", BASE))
                .contains(new AnnouncementImage("https://event-us.kr/img/tw.jpg", "photo", null));
        // 아이콘은 로고라 자르지 않게 poster
        assertThat(PreviewParser.parse("<link rel=\"apple-touch-icon\" href=\"/webclip.png\">", BASE))
                .contains(new AnnouncementImage("https://event-us.kr/webclip.png", "poster", null));
    }

    @Test
    void 로고_이미지는_자르지_않게_poster로_둔다() {
        String html = "<meta property=\"og:image\" content=\"https://cdn.example.com/logos/ACME_Wordmark.png\">";
        assertThat(PreviewParser.parse(html, BASE)).hasValueSatisfying(i -> assertThat(i.kind()).isEqualTo("poster"));
    }

    @Test
    void http가_아닌_주소나_빈_값은_버린다() {
        assertThat(PreviewParser.parse("<meta property=\"og:image\" content=\"data:image/png;base64,AAAA\">", BASE))
                .isEmpty();
        assertThat(PreviewParser.parse("<meta property=\"og:image\" content=\"javascript:alert(1)\">", BASE)).isEmpty();
        assertThat(PreviewParser.parse("<meta property=\"og:image\" content=\"\">", BASE)).isEmpty();
        assertThat(PreviewParser.parse("<p>이미지 없음</p>", BASE)).isEmpty();
    }

    @Test
    void 내부_주소와_기본이_아닌_포트는_열지_않는다() throws Exception {
        assertThat(PageFetcher.allowed(URI.create("http://127.0.0.1/"))).isFalse();
        assertThat(PageFetcher.allowed(URI.create("http://169.254.169.254/latest/meta-data/"))).isFalse();
        assertThat(PageFetcher.allowed(URI.create("http://10.0.0.5/"))).isFalse();
        assertThat(PageFetcher.allowed(URI.create("http://172.26.8.25/"))).isFalse();
        assertThat(PageFetcher.allowed(URI.create("http://[::1]/"))).isFalse();
        assertThat(PageFetcher.allowed(URI.create("http://93.184.215.14:8082/"))).isFalse();
        assertThat(PageFetcher.allowed(URI.create("file:///etc/passwd"))).isFalse();
        assertThat(PageFetcher.internal(InetAddress.getByName("100.64.0.1"))).isTrue();
        assertThat(PageFetcher.internal(InetAddress.getByName("fd00::1"))).isTrue();
        assertThat(PageFetcher.internal(InetAddress.getByName("93.184.215.14"))).isFalse();
    }
}
