package dev.imjaewoo.gonggo.me;

import dev.imjaewoo.gonggo.auth.AuthUser;
import dev.imjaewoo.gonggo.auth.UserAccounts;
import dev.imjaewoo.gonggo.me.MeDtos.Application;
import dev.imjaewoo.gonggo.me.MeDtos.CalendarEvent;
import dev.imjaewoo.gonggo.me.MeDtos.ChangeAlerts;
import dev.imjaewoo.gonggo.me.MeDtos.Notification;
import dev.imjaewoo.gonggo.me.MeDtos.Profile;
import dev.imjaewoo.gonggo.me.MeDtos.Saved;
import dev.imjaewoo.gonggo.me.MeDtos.SentReminders;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 로그인한 사용자 본인의 데이터. 사용자는 항상 세션에서 정하고, 경로에 사용자 id를 받지 않는다 */
@RestController
@RequestMapping("/api/me")
class MeController {

    private final PersonalDataService data;
    private final UserAccounts accounts;

    MeController(PersonalDataService data, UserAccounts accounts) {
        this.data = data;
        this.accounts = accounts;
    }

    @GetMapping
    MeDtos.Me me(@AuthenticationPrincipal AuthUser user) {
        if (!accounts.exists(user.id())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return data.load(new MeDtos.UserView(user.id(), user.nickname()));
    }

    @PutMapping("/profile")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void putProfile(@AuthenticationPrincipal AuthUser user, @RequestBody @Validated Profile body) {
        data.putProfile(user.id(), body);
    }

    @DeleteMapping("/profile")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteProfile(@AuthenticationPrincipal AuthUser user) {
        data.deleteProfile(user.id());
    }

    @PutMapping("/change-alerts")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void putChangeAlerts(@AuthenticationPrincipal AuthUser user, @RequestBody ChangeAlerts body) {
        data.putChangeAlerts(user.id(), body);
    }

    @PutMapping("/saved/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void putSaved(@AuthenticationPrincipal AuthUser user, @PathVariable String announcementId,
            @RequestBody @Validated Saved body) {
        data.putSaved(user.id(), announcementId, body);
    }

    @DeleteMapping("/saved/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteSaved(@AuthenticationPrincipal AuthUser user, @PathVariable String announcementId) {
        data.deleteSaved(user.id(), announcementId);
    }

    @PutMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void putEvent(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
            @RequestBody @Validated CalendarEvent body) {
        data.putEvent(user.id(), id, body);
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEvent(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        data.deleteEvent(user.id(), id);
    }

    @PutMapping("/notifications/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void putNotification(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
            @RequestBody @Validated Notification body) {
        data.putNotification(user.id(), id, body);
    }

    @PostMapping("/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void readAll(@AuthenticationPrincipal AuthUser user) {
        data.readAllNotifications(user.id());
    }

    @PutMapping("/applications/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void putApplication(@AuthenticationPrincipal AuthUser user, @PathVariable String announcementId,
            @RequestBody @Validated Application body) {
        data.putApplication(user.id(), announcementId, body);
    }

    @DeleteMapping("/applications/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteApplication(@AuthenticationPrincipal AuthUser user, @PathVariable String announcementId) {
        data.deleteApplication(user.id(), announcementId);
    }

    @PostMapping("/sent-reminders")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void addSentReminders(@AuthenticationPrincipal AuthUser user, @RequestBody @Validated SentReminders body) {
        data.addSentKeys(user.id(), body.keys());
    }

    /** 탈퇴: 계정과 모든 개인 데이터를 지우고 로그아웃한다 */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAccount(@AuthenticationPrincipal AuthUser user, HttpServletRequest request,
            HttpServletResponse response) {
        accounts.delete(user.id());
        new SecurityContextLogoutHandler().logout(request, response, null);
    }
}
