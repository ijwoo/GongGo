package dev.imjaewoo.gonggo.ingestion.demo;

import dev.imjaewoo.gonggo.announcement.AnnouncementRepository;
import dev.imjaewoo.gonggo.ingestion.IngestionService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** 데모 공고가 하나도 없을 때만 한 번 넣는다. API 키 없이도 화면을 볼 수 있게 하기 위함 */
@Component
class DemoSeeder implements ApplicationRunner {

    private final DemoSourceAdapter demo;
    private final AnnouncementRepository announcements;
    private final IngestionService ingestion;

    DemoSeeder(DemoSourceAdapter demo, AnnouncementRepository announcements, IngestionService ingestion) {
        this.demo = demo;
        this.announcements = announcements;
        this.ingestion = ingestion;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (demo.enabled() && announcements.countBySourceId(demo.sourceId()) == 0) {
            ingestion.run(demo, "startup");
        }
    }
}
