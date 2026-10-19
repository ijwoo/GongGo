package dev.imjaewoo.gonggo.ingestion.kstartup;

import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * K-Startup 사업공고 API 설정. 필드명은 코드가 아니라 sources/kstartup-mapping.yml에 둔다.
 * 응답 모양이 확인되지 않았기 때문이다(docs/backend-design.md 5.1).
 */
@ConfigurationProperties("gonggo.kstartup")
public record KStartupProperties(
        String serviceKey,
        String endpoint,
        Map<String, String> params,
        String pageParam,
        String sizeParam,
        Integer pageSize,
        Integer maxPages,
        /** 응답에서 공고 배열 위치(JSON Pointer) */
        String itemsPointer,
        List<String> dateFormats,
        Fields fields) {

    public record Fields(
            String externalId,
            String title,
            String organizer,
            String url,
            String startDate,
            String endDate,
            String region,
            String target,
            String publishedAt) {
    }

    public boolean configured() {
        return serviceKey != null && !serviceKey.isBlank() && endpoint != null && fields != null;
    }
}
