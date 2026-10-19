package dev.imjaewoo.gonggo.api;

import dev.imjaewoo.gonggo.ingestion.IngestionRunView;
import dev.imjaewoo.gonggo.ingestion.IngestionService;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 운영자용 수집 API. ADMIN_TOKEN이 없으면 모두 거절한다 */
@RestController
@RequestMapping("/api/admin/ingestions")
class AdminIngestionController {

    private final IngestionService ingestion;
    private final String adminToken;

    AdminIngestionController(IngestionService ingestion, @Value("${gonggo.admin-token:}") String adminToken) {
        this.ingestion = ingestion;
        this.adminToken = adminToken;
    }

    @PostMapping("/{sourceId}")
    IngestionRunView run(@PathVariable String sourceId,
            @RequestHeader(name = "X-Admin-Token", required = false) String token) {
        authorize(token);
        SourceAdapter adapter = ingestion.adapter(sourceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "없는 출처입니다: " + sourceId));
        if (!adapter.enabled()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "꺼져 있는 출처입니다: " + sourceId + " (필요한 설정·API 키를 확인하세요)");
        }
        return ingestion.run(adapter, "manual")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "이미 수집 중입니다: " + sourceId));
    }

    @GetMapping
    List<IngestionRunView> recent(@RequestHeader(name = "X-Admin-Token", required = false) String token) {
        authorize(token);
        return ingestion.recentRuns(20);
    }

    private void authorize(String token) {
        if (adminToken == null || adminToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN_TOKEN이 설정되지 않아 관리자 API를 쓸 수 없습니다.");
        }
        if (token == null || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),
                adminToken.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "관리자 토큰이 올바르지 않습니다.");
        }
    }
}
