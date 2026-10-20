package dev.imjaewoo.gonggo.preview;

import dev.imjaewoo.gonggo.announcement.model.AnnouncementImage;
import java.net.URI;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * HTML 앞부분에서 대표 이미지를 고른다: og:image → twitter:image → apple-touch-icon.
 * HTML 전체를 해석하지 않고 meta·link 태그의 속성만 읽는다(속성 순서·따옴표 종류와 무관).
 * 아이콘이나 주소에 logo가 들어간 이미지는 글자·로고가 잘리지 않게 poster로 둔다.
 */
public final class PreviewParser {

    private static final Pattern TAG = Pattern.compile("<(meta|link)\\b([^>]*)>", Pattern.CASE_INSENSITIVE);
    private static final Pattern ATTR = Pattern.compile(
            "([a-zA-Z_:][-a-zA-Z0-9_:.]*)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'>]+))");
    private static final int MAX_URL = 1000;

    private PreviewParser() {
    }

    public static Optional<AnnouncementImage> parse(String html, URI base) {
        String og = null;
        String twitter = null;
        String icon = null;
        Matcher m = TAG.matcher(html);
        while (m.find()) {
            Map<String, String> attrs = attrs(m.group(2));
            if (m.group(1).equalsIgnoreCase("meta")) {
                String key = attrs.getOrDefault("property", attrs.getOrDefault("name", "")).toLowerCase(Locale.ROOT);
                String content = attrs.get("content");
                if (og == null && (key.equals("og:image") || key.equals("og:image:url")
                        || key.equals("og:image:secure_url"))) {
                    og = content;
                } else if (twitter == null && (key.equals("twitter:image") || key.equals("twitter:image:src"))) {
                    twitter = content;
                }
            } else if (icon == null && attrs.getOrDefault("rel", "").toLowerCase(Locale.ROOT)
                    .contains("apple-touch-icon")) {
                icon = attrs.get("href");
            }
        }
        for (String candidate : new String[] {og, twitter}) {
            Optional<URI> url = resolve(base, candidate);
            if (url.isPresent()) {
                String s = url.get().toString();
                return Optional.of(new AnnouncementImage(s, s.toLowerCase(Locale.ROOT).contains("logo") ? "poster" : "photo",
                        null));
            }
        }
        return resolve(base, icon).map(u -> new AnnouncementImage(u.toString(), "poster", null));
    }

    private static Map<String, String> attrs(String raw) {
        Map<String, String> out = new HashMap<>();
        Matcher m = ATTR.matcher(raw);
        while (m.find()) {
            String v = m.group(2) != null ? m.group(2) : m.group(3) != null ? m.group(3) : m.group(4);
            out.putIfAbsent(m.group(1).toLowerCase(Locale.ROOT), unescape(v.strip()));
        }
        return out;
    }

    /** 상대 주소를 풀고 http(s)만 남긴다 */
    static Optional<URI> resolve(URI base, String raw) {
        if (raw == null || raw.isBlank() || raw.startsWith("data:")) {
            return Optional.empty();
        }
        try {
            URI u = base.resolve(raw.strip().replace(" ", "%20"));
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || u.getHost() == null
                    || u.toString().length() > MAX_URL) {
                return Optional.empty();
            }
            return Optional.of(u);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static String unescape(String s) {
        return s.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&#x2F;", "/");
    }
}
