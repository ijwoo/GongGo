package dev.imjaewoo.gonggo.ingestion.devevent;

import dev.imjaewoo.gonggo.ingestion.SourceRecord;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Dev-Event README(마크다운) → 행사 한 건씩. 형식은 아래와 같다.
 * <pre>
 * ## `26년 10월`
 * - __[행사명](https://...)__
 *   - 분류: `오프라인(서울 강남구)`, `무료`, `세미나`, `AI`
 *   - 주최: 한빛미디어
 *   - 접수: 10. 07(수) 12:00 ~ 10. 20(화) 13:00
 *   - 일시: 10. 22(목) 14:00
 * </pre>
 * 해석(날짜·분류)은 하지 않고 글자 그대로 담는다. 원본 저장(raw_records)에 README 모양이 남게 하려는 것이다.
 */
public final class DevEventParser {

    private static final Pattern COMMENT = Pattern.compile("<!--.*?-->", Pattern.DOTALL);
    private static final Pattern MONTH = Pattern.compile("^## `(\\d{2})년 (\\d{1,2})월`\\s*$");
    private static final Pattern ITEM = Pattern.compile("^- __\\[(.+)]\\((\\S+)\\)__\\s*$");
    private static final Pattern FIELD = Pattern.compile("^\\s+- ([^:]+):\\s*(.*)$");
    private static final Pattern TAG = Pattern.compile("`([^`]+)`");

    private final JsonMapper json;

    public DevEventParser(JsonMapper json) {
        this.json = json;
    }

    public List<SourceRecord> parse(String markdown) {
        List<SourceRecord> records = new ArrayList<>();
        String month = null;
        ObjectNode current = null;
        for (String line : COMMENT.matcher(markdown).replaceAll("").split("\n")) {
            Matcher m;
            if ((m = MONTH.matcher(line)).matches()) {
                month = String.format("20%s-%02d", m.group(1), Integer.parseInt(m.group(2)));
                current = null;
            } else if (line.startsWith("## ")) {
                month = null; // 월 목록이 끝났다(기여자 등 다른 절)
                current = null;
            } else if (month != null && (m = ITEM.matcher(line)).matches()) {
                current = json.createObjectNode()
                        .put("month", month)
                        .put("title", unescape(m.group(1)))
                        .put("url", m.group(2));
                records.add(new SourceRecord(externalId(m.group(2)), current));
            } else if (current != null && (m = FIELD.matcher(line)).matches()) {
                String key = m.group(1).strip();
                String value = m.group(2).strip();
                switch (key) {
                    case "분류" -> {
                        var tags = current.putArray("tags");
                        TAG.matcher(value).results().forEach(t -> tags.add(t.group(1).strip()));
                    }
                    case "주최" -> current.put("organizer", value);
                    case "접수" -> current.put("apply", value);
                    case "일시" -> current.put("when", value);
                    default -> current.put("extra:" + key, value);
                }
            }
        }
        return records;
    }

    /** 같은 행사는 링크가 같다. 제목·일정이 고쳐져도 같은 공고로 본다 */
    static String externalId(String url) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String unescape(String s) {
        return s.replaceAll("\\\\([\\[\\]()_*`])", "$1").strip();
    }
}
