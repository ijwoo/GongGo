package dev.imjaewoo.gonggo;

import dev.imjaewoo.gonggo.ingestion.FakeSourceAdapter;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

/**
 * 실제 PostgreSQL(Testcontainers)에 Flyway 스키마를 올려 돌리는 통합 테스트의 공통 설정.
 * 시각은 웹 E2E와 같은 2026-10-21T01:00Z(서울 10:00)로 고정한다.
 */
@SpringBootTest(properties = {
        "gonggo.clock.fixed-now=2026-10-21T01:00:00Z",
        "gonggo.demo.anchor-date=2026-10-21",
        "gonggo.admin-token=test-admin-token",
        "gonggo.ingestion.scheduler-enabled=false",
})
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FakeSourceAdapter.class})
public abstract class IntegrationTest {
}
