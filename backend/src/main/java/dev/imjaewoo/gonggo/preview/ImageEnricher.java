package dev.imjaewoo.gonggo.preview;

import dev.imjaewoo.gonggo.announcement.AnnouncementImageStore;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementImage;
import dev.imjaewoo.gonggo.ingestion.SourceAdapter;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 수집이 끝난 출처의 공고에 대표 이미지를 붙인다. 원문 페이지에서 찾고, 없으면 출처가 알려 준 대체 주소
 * (채용 공고라면 회사 홈페이지)에서 찾는다. 같은 대체 주소는 한 번의 실행에서 한 번만 연다.
 * 실패해도 수집 결과에는 영향이 없고, 못 찾은 공고는 RETRY_AFTER가 지나면 다시 찾는다.
 */
@Service
public class ImageEnricher {

    private static final Logger log = LoggerFactory.getLogger(ImageEnricher.class);
    private static final Duration RETRY_AFTER = Duration.ofDays(7);
    /** 한 번에 여는 페이지 수 상한(서버·상대 사이트 부담) */
    private static final int MAX_PER_RUN = 300;
    private static final int THREADS = 6;

    private final AnnouncementImageStore store;
    private final PageFetcher fetcher;
    private final Clock clock;
    private final boolean enabled;

    public ImageEnricher(AnnouncementImageStore store, PageFetcher fetcher, Clock clock,
            @Value("${gonggo.images.enabled:true}") boolean enabled) {
        this.store = store;
        this.fetcher = fetcher;
        this.clock = clock;
        this.enabled = enabled;
    }

    public void enrich(SourceAdapter adapter) {
        if (!enabled) {
            return;
        }
        List<AnnouncementImageStore.Pending> pending = store.pending(adapter.sourceId(),
                clock.instant().minus(RETRY_AFTER), MAX_PER_RUN);
        if (pending.isEmpty()) {
            return;
        }
        Map<String, Optional<AnnouncementImage>> fallbacks = new ConcurrentHashMap<>();
        AtomicInteger found = new AtomicInteger();
        try (ExecutorService pool = Executors.newFixedThreadPool(THREADS)) {
            for (var p : pending) {
                pool.submit(() -> {
                    try {
                        Optional<AnnouncementImage> image = lookup(p.sourceUrl());
                        if (image.isEmpty()) {
                            image = adapter.previewFallbackUrl(p.organizerName())
                                    .flatMap(url -> fallbacks.computeIfAbsent(url, this::lookup));
                        }
                        store.save(p.announcementId(), image.orElse(null), clock.instant());
                        image.ifPresent(i -> found.incrementAndGet());
                    } catch (RuntimeException e) {
                        log.warn("[images] {} 이미지 찾기 실패: {}", p.announcementId(), e.toString());
                    }
                });
            }
        }
        log.info("[images] {} — {}건 중 {}건 이미지 찾음", adapter.sourceId(), pending.size(), found.get());
    }

    private Optional<AnnouncementImage> lookup(String url) {
        try {
            return fetcher.fetch(URI.create(url.strip()))
                    .flatMap(page -> PreviewParser.parse(page.html(), page.finalUrl()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
