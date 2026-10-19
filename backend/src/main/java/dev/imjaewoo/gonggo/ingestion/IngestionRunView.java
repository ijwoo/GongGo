package dev.imjaewoo.gonggo.ingestion;

import java.time.Instant;

public record IngestionRunView(
        long id,
        String sourceId,
        String trigger,
        String status,
        Instant startedAt,
        Instant finishedAt,
        int fetchedCount,
        int createdCount,
        int changedCount,
        int unchangedCount,
        int errorCount,
        String errorMessage) {
}
