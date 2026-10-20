package dev.imjaewoo.gonggo.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
class AuthController {

    private final ObjectProvider<ClientRegistrationRepository> clients;
    private final UserAccounts accounts;
    private final LoginSessions sessions;
    private final boolean testLoginEnabled;

    AuthController(ObjectProvider<ClientRegistrationRepository> clients, UserAccounts accounts, LoginSessions sessions,
            @Value("${gonggo.auth.test-login-enabled:false}") boolean testLoginEnabled) {
        this.clients = clients;
        this.accounts = accounts;
        this.sessions = sessions;
        this.testLoginEnabled = testLoginEnabled;
    }

    record SessionResponse(boolean authenticated, AuthUser user, boolean kakaoEnabled, boolean testLoginEnabled) {
    }

    /** 로그인 상태와 쓸 수 있는 로그인 방식. 호출하면 CSRF 쿠키도 내려간다 */
    @GetMapping("/session")
    SessionResponse session(@AuthenticationPrincipal AuthUser user, CsrfToken csrf) {
        csrf.getToken(); // 쿠키 발급
        // 세션은 남아 있는데 탈퇴 등으로 계정이 없어졌으면 로그인하지 않은 것으로 본다
        boolean valid = user != null && accounts.exists(user.id());
        return new SessionResponse(valid, valid ? user : null, clients.getIfAvailable() != null, testLoginEnabled);
    }

    record TestLoginRequest(@NotBlank @Size(max = 40) String nickname) {
    }

    /**
     * 테스트 전용 로그인(E2E·로컬). gonggo.auth.test-login-enabled=true일 때만 열린다. 운영에서는 404.
     * 카카오 로그인과 같은 세션을 만들므로, 로그인 이후 동작은 실제와 같은 경로로 검증된다.
     */
    @PostMapping("/test-login")
    AuthUser testLogin(@RequestBody @Validated TestLoginRequest body, HttpServletRequest request,
            HttpServletResponse response) {
        if (!testLoginEnabled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        AuthUser user = accounts.upsert("test", body.nickname(), body.nickname());
        sessions.signIn(user, request, response);
        return user;
    }
}
