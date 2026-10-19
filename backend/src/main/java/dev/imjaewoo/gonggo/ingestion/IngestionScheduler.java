package dev.imjaewoo.gonggo.ingestion;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 정기 수집. 켜진 출처를 차례로 돈다 */
@Component
@ConditionalOnProperty(name = "gonggo.ingestion.scheduler-enabled", havingValue = "true", matchIfMissing = true)
class IngestionScheduler {

    private final IngestionService ingestion;

    IngestionScheduler(IngestionService ingestion) {
        this.ingestion = ingestion;
    }

    @Scheduled(cron = "${gonggo.ingestion.cron}", zone = "Asia/Seoul")
    void runScheduled() {
        ingestion.scheduledAdapters().forEach(adapter -> ingestion.run(adapter, "schedule"));
    }
}
