package dev.imjaewoo.gonggo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.imjaewoo.gonggo.IntegrationTest;
import dev.imjaewoo.gonggo.announcement.Incoming;
import dev.imjaewoo.gonggo.announcement.model.AnnouncementContent;
import dev.imjaewoo.gonggo.announcement.model.ApplicationStart;
import dev.imjaewoo.gonggo.announcement.model.Deadline;
import dev.imjaewoo.gonggo.announcement.model.EventSchedule;
import dev.imjaewoo.gonggo.announcement.model.Organizer;
import dev.imjaewoo.gonggo.announcement.model.Venue;
import dev.imjaewoo.gonggo.ingestion.FakeSourceAdapter;
import dev.imjaewoo.gonggo.ingestion.IngestionService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.node.JsonNodeFactory;

/** 로그인 세션, CSRF, 사용자별 데이터 분리, 개인 데이터 API의 모양과 규칙 */
class AuthAndMeTest extends IntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired IngestionService ingestion;
    @Autowired FakeSourceAdapter fake;

    @AfterEach
    void tearDown() {
        jdbc.sql("delete from users").update();
        fake.items.clear();
        jdbc.sql("delete from announcements where source_id = 'fake'").update();
    }

    @Test
    void 로그인하지_않으면_세션_정보만_보이고_개인_API는_401() throws Exception {
        mvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.kakaoEnabled").value(false))
                .andExpect(jsonPath("$.testLoginEnabled").value(true))
                .andExpect(cookie().exists("XSRF-TOKEN"));
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void 상태를_바꾸는_요청은_CSRF_토큰이_필요하다() throws Exception {
        mvc.perform(post("/api/auth/test-login").contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"a\"}"))
                .andExpect(status().isForbidden());
        Cookie[] s = login("민지");
        mvc.perform(put("/api/me/change-alerts").cookie(s).contentType(MediaType.APPLICATION_JSON)
                .content("{\"deadline\":false,\"venue\":true,\"conditions\":true,\"cancel\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 개인_데이터를_저장하고_웹_계약_모양으로_읽는다() throws Exception {
        Cookie[] s = login("민지");
        String eventId = UUID.randomUUID().toString();

        perform(put("/api/me/saved/hk-pangyo-ai"), s,
                "{\"announcementId\":\"hk-pangyo-ai\",\"savedAt\":\"2026-10-21T01:00:00Z\",\"seenVersion\":1}");
        perform(put("/api/me/events/" + eventId), s, """
                {"id":"%s","announcementId":"hk-pangyo-ai","kind":"deadline","title":"판교 마감",
                 "timing":{"type":"allDay","start":"2026-10-26","end":"2026-10-26","timeUnknown":true},
                 "sourceVersion":1,"reminders":[{"id":"r1","offset":{"type":"preset","days":1},"channel":"inApp"},
                 {"id":"r2","offset":{"type":"custom","days":2,"time":"08:30"},"channel":"email"}],
                 "memo":"","createdAt":"2026-10-21T01:00:00Z","updatedAt":"2026-10-21T01:00:00Z"}""".formatted(eventId));
        perform(put("/api/me/notifications/n1"), s, """
                {"id":"n1","type":"reminder","title":"알림","body":"본문","createdAt":"2026-10-21T01:00:00Z",
                 "read":false,"link":{"kind":"event","id":"%s"},"dedupeKey":"k1","delivery":"failed",
                 "failureReason":"이메일 미설정"}""".formatted(eventId));
        perform(put("/api/me/applications/hk-pangyo-ai"), s, """
                {"announcementId":"hk-pangyo-ai","status":"preparing","memo":"메모",
                 "checklist":[{"id":"c1","label":"팀 구성표","done":true}],"updatedAt":"2026-10-21T01:00:00Z"}""");
        perform(put("/api/me/profile"), s,
                "{\"interests\":[\"hackathon\"],\"region\":\"서울\",\"career\":\"3-5\",\"teamSize\":3,\"startupYears\":null}");
        perform(post("/api/me/sent-reminders"), s, "{\"keys\":[\"k1\",\"k1\",\"k2\"]}");
        perform(post("/api/me/notifications/read-all"), s, "");

        mvc.perform(get("/api/me").cookie(s))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.nickname").value("민지"))
                .andExpect(jsonPath("$.saved[0].announcementId").value("hk-pangyo-ai"))
                .andExpect(jsonPath("$.events[0].timing.type").value("allDay"))
                .andExpect(jsonPath("$.events[0].timing.timeUnknown").value(true))
                .andExpect(jsonPath("$.events[0].reminders", hasSize(2)))
                .andExpect(jsonPath("$.events[0].reminders[1].offset.time").value("08:30"))
                .andExpect(jsonPath("$.notifications[0].read").value(true))
                .andExpect(jsonPath("$.notifications[0].failureReason").value("이메일 미설정"))
                .andExpect(jsonPath("$.applications[0].checklist[0].done").value(true))
                .andExpect(jsonPath("$.profile.startupYears").isEmpty())
                .andExpect(jsonPath("$.changeAlerts.deadline").value(true))
                .andExpect(jsonPath("$.sentReminderKeys", hasSize(2)));
    }

    @Test
    void 같은_공고의_같은_종류_일정은_한_번만() throws Exception {
        Cookie[] s = login("민지");
        perform(put("/api/me/events/e1"), s, event("e1", "deadline"));
        mvc.perform(withJson(put("/api/me/events/e2"), s, event("e2", "deadline")))
                .andExpect(status().isConflict());
        // 준비 일정은 여러 개 가능
        perform(put("/api/me/events/p1"), s, event("p1", "prep"));
        perform(put("/api/me/events/p2"), s, event("p2", "prep"));
    }

    @Test
    void 다른_사용자의_데이터는_보이지도_바뀌지도_않는다() throws Exception {
        Cookie[] a = login("가");
        Cookie[] b = login("나");
        perform(put("/api/me/events/same-id"), a, event("same-id", "deadline"));

        // 같은 id를 써도 B의 행이 따로 생기고, B의 삭제는 A에 닿지 않는다
        perform(put("/api/me/events/same-id"), b, event("same-id", "event"));
        mvc.perform(delete("/api/me/events/same-id").cookie(b).with(csrf())).andExpect(status().isNoContent());

        mvc.perform(get("/api/me").cookie(a)).andExpect(jsonPath("$.events", hasSize(1)))
                .andExpect(jsonPath("$.events[0].kind").value("deadline"));
        mvc.perform(get("/api/me").cookie(b)).andExpect(jsonPath("$.events", hasSize(0)));
    }

    @Test
    void 없는_공고는_저장할_수_없고_잘못된_값은_400() throws Exception {
        Cookie[] s = login("민지");
        mvc.perform(withJson(put("/api/me/saved/nope"), s,
                "{\"announcementId\":\"nope\",\"savedAt\":\"2026-10-21T01:00:00Z\",\"seenVersion\":1}"))
                .andExpect(status().isNotFound());
        mvc.perform(withJson(put("/api/me/saved/hk-pangyo-ai"), s,
                "{\"announcementId\":\"other\",\"savedAt\":\"2026-10-21T01:00:00Z\",\"seenVersion\":1}"))
                .andExpect(status().isBadRequest());
        // 7·3·1·0일 외의 preset 알림
        mvc.perform(withJson(put("/api/me/events/e1"), s, event("e1", "deadline").replace("\"days\":1", "\"days\":5")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 탈퇴하면_데이터와_세션이_모두_사라진다() throws Exception {
        Cookie[] s = login("민지");
        perform(put("/api/me/events/e1"), s, event("e1", "deadline"));
        mvc.perform(delete("/api/me").cookie(s).with(csrf())).andExpect(status().isNoContent());

        mvc.perform(get("/api/me").cookie(s)).andExpect(status().isUnauthorized());
        assertThat(jdbc.sql("select count(*) from calendar_events").query(Long.class).single()).isZero();
    }

    @Test
    void 관심_공고가_바뀌면_서버가_변경_알림을_만든다() throws Exception {
        jdbc.sql("""
                insert into sources (id, name, attribution, allow_transform, permission_note)
                values ('fake', '테스트 출처', '테스트', true, '테스트') on conflict do nothing""").update();
        fake.items.put("x1", now -> incoming(new Deadline.OnDate(LocalDate.of(2026, 10, 31)), now));
        ingestion.run(fake, "manual");

        Cookie[] saver = login("저장한 사람");
        Cookie[] other = login("상관없는 사람");
        perform(put("/api/me/saved/fake-x1"), saver,
                "{\"announcementId\":\"fake-x1\",\"savedAt\":\"2026-10-21T01:00:00Z\",\"seenVersion\":1}");

        fake.items.put("x1", now -> incoming(new Deadline.OnDate(LocalDate.of(2026, 11, 7)), now));
        ingestion.run(fake, "manual");
        ingestion.run(fake, "manual"); // 다시 돌려도 같은 알림이 또 생기지 않는다

        mvc.perform(get("/api/me").cookie(saver))
                .andExpect(jsonPath("$.notifications", hasSize(1)))
                .andExpect(jsonPath("$.notifications[0].type").value("change"))
                .andExpect(jsonPath("$.notifications[0].title").value("마감일이 바뀌었어요"))
                .andExpect(jsonPath("$.notifications[0].dedupeKey").value("change:fake-x1:v2"))
                .andExpect(jsonPath("$.notifications[0].link.id").value("fake-x1"));
        mvc.perform(get("/api/me").cookie(other)).andExpect(jsonPath("$.notifications", hasSize(0)));
    }

    /* ───────── 도우미 ───────── */

    private Cookie[] login(String nickname) throws Exception {
        var res = mvc.perform(post("/api/auth/test-login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"" + nickname + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        Cookie session = res.getCookie("GONGGO_SESSION");
        assertThat(session).as("세션 쿠키").isNotNull();
        assertThat(session.isHttpOnly()).isTrue();
        return new Cookie[] {session};
    }

    private MockHttpServletRequestBuilder withJson(MockHttpServletRequestBuilder b, Cookie[] s, String body) {
        return b.cookie(s).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private void perform(MockHttpServletRequestBuilder b, Cookie[] s, String body) throws Exception {
        mvc.perform(withJson(b, s, body)).andExpect(status().isNoContent());
    }

    private static String event(String id, String kind) {
        return """
                {"id":"%s","announcementId":"hk-pangyo-ai","kind":"%s","title":"일정",
                 "timing":{"type":"timed","start":"2026-10-26T09:00:00Z","end":null},"sourceVersion":1,
                 "reminders":[{"id":"r1","offset":{"type":"preset","days":1},"channel":"inApp"}],
                 "memo":"","createdAt":"2026-10-21T01:00:00Z","updatedAt":"2026-10-21T01:00:00Z"}"""
                .formatted(id, kind);
    }

    private static Incoming incoming(Deadline deadline, Instant now) {
        AnnouncementContent c = new AnnouncementContent("fake-x1", "변경 알림 공고", new Organizer("기관", null, "#3182F6"),
                "event", "fake", "https://example.com/x1", "테스트", Instant.parse("2026-10-01T00:00:00Z"),
                Instant.parse("2026-10-01T00:00:00Z"), new ApplicationStart.Tbd(), deadline, new EventSchedule.Tbd(),
                "online", new Venue.Online(null), List.of(), null, null, null, JsonNodeFactory.instance.arrayNode(),
                List.of(), List.of(), "active");
        return Incoming.fresh("x1", c, now);
    }
}
