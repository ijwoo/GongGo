package dev.imjaewoo.gonggo.api;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.imjaewoo.gonggo.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/** 데모 34건이 시작할 때 들어가고, 웹 계약 모양으로 조회되는지 확인한다 */
class AnnouncementApiTest extends IntegrationTest {

    @Autowired MockMvc mvc;

    @Test
    void 마감_포함_전체_목록과_서버_시각() throws Exception {
        mvc.perform(get("/api/announcements").param("includeClosed", "true").param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(34))
                .andExpect(jsonPath("$.items.length()").value(34))
                .andExpect(jsonPath("$.serverTime").value("2026-10-21T01:00:00Z"));
    }

    @Test
    void 기본_목록은_마감_취소를_빼고_마감순으로_정렬한다() throws Exception {
        mvc.perform(get("/api/announcements").param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", lessThan(34)))
                .andExpect(jsonPath("$.items[*].status", everyItem(is("active"))))
                // 판교 해커톤: 데모 기준일 +5일 18:00 마감 → 가장 가까운 마감 중 하나
                .andExpect(jsonPath("$.items[0].applicationDeadline.type").value("datetime"));
    }

    @Test
    void 공고_한_건은_웹_계약과_같은_모양이다() throws Exception {
        mvc.perform(get("/api/announcements/hk-pangyo-ai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("hk-pangyo-ai"))
                .andExpect(jsonPath("$.organizer.address").exists())
                .andExpect(jsonPath("$.applicationDeadline.type").value("datetime"))
                .andExpect(jsonPath("$.applicationDeadline.at").value("2026-10-26T09:00:00Z"))
                .andExpect(jsonPath("$.event.type").value("dates"))
                .andExpect(jsonPath("$.event.start").value("2026-11-09"))
                .andExpect(jsonPath("$.venue.status").value("confirmed"))
                .andExpect(jsonPath("$.venue.coordinates.lat").value(37.4022))
                .andExpect(jsonPath("$.teamSize.min").value(2))
                .andExpect(jsonPath("$.cost.type").value("free"))
                .andExpect(jsonPath("$.conditions[0].rule.type").value("teamSize"))
                .andExpect(jsonPath("$.contentVersion").value(1))
                .andExpect(jsonPath("$.revisions.length()").value(0));
    }

    @Test
    void 시각_미공지_마감은_날짜만_내려_준다() throws Exception {
        mvc.perform(get("/api/announcements").param("includeClosed", "true").param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.applicationDeadline.type == 'date')].applicationDeadline",
                        everyItem(not(hasKey("at")))))
                // 정보 없음(null)은 필드를 빼지 않고 null로 내려 준다
                .andExpect(jsonPath("$.items[?(@.teamSize == null)]", not(nullValue())))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"teamSize\":null")));
    }

    @Test
    void 변경_이력이_있는_데모_공고() throws Exception {
        mvc.perform(get("/api/announcements").param("includeClosed", "true").param("size", "500"))
                .andExpect(jsonPath("$.items[?(@.revisions.length() > 0)].contentVersion", everyItem(
                        org.hamcrest.Matchers.greaterThan(1))));
    }

    @Test
    void 분야_지역_검색어_필터() throws Exception {
        mvc.perform(get("/api/announcements").param("cat", "hackathon").param("size", "500"))
                .andExpect(jsonPath("$.items[*].category", everyItem(is("hackathon"))));
        mvc.perform(get("/api/announcements").param("region", "경기").param("size", "500"))
                .andExpect(jsonPath("$.items[*].venue.address", everyItem(org.hamcrest.Matchers.startsWith("경기"))));
        mvc.perform(get("/api/announcements").param("q", "판교 해커톤"))
                .andExpect(jsonPath("$.items[0].id").value("hk-pangyo-ai"));
        // 허용하지 않는 값은 버린다
        mvc.perform(get("/api/announcements").param("cat", "unknown").param("size", "500"))
                .andExpect(status().isOk());
    }

    @Test
    void 잘못된_페이지_크기와_없는_공고는_ProblemDetail로_답한다() throws Exception {
        mvc.perform(get("/api/announcements").param("size", "501"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        mvc.perform(get("/api/announcements/none"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("공고를 찾을 수 없습니다."));
    }

    @Test
    void 관리자_API는_토큰이_있어야_한다() throws Exception {
        mvc.perform(post("/api/admin/ingestions/demo")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/ingestions/demo").header("X-Admin-Token", "wrong"))
                .andExpect(status().isUnauthorized());
        // 키 없는 K-Startup은 꺼져 있다
        mvc.perform(post("/api/admin/ingestions/kstartup").header("X-Admin-Token", "test-admin-token"))
                .andExpect(status().isConflict());
        // 데모를 다시 돌려도 같은 기준일이면 바뀌는 것이 없다(멱등)
        mvc.perform(post("/api/admin/ingestions/demo").header("X-Admin-Token", "test-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("succeeded"))
                .andExpect(jsonPath("$.createdCount").value(0))
                .andExpect(jsonPath("$.unchangedCount").value(34));
        mvc.perform(get("/api/admin/ingestions").header("X-Admin-Token", "test-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sourceId").exists());
    }
}
