package dev.imjaewoo.gonggo.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/** 카카오 인증이 끝나면 우리 계정을 만들거나 찾아 세션에 넣고, 웹의 로그인 완료 화면으로 보낸다 */
@Component
class KakaoLoginSuccessHandler implements AuthenticationSuccessHandler {

    private final UserAccounts accounts;
    private final LoginSessions sessions;

    KakaoLoginSuccessHandler(UserAccounts accounts, LoginSessions sessions) {
        this.accounts = accounts;
        this.sessions = sessions;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException {
        OAuth2User kakao = (OAuth2User) authentication.getPrincipal();
        AuthUser user = accounts.upsert("kakao", String.valueOf(kakao.getAttributes().get("id")), nickname(kakao));
        sessions.signIn(user, request, response);
        response.sendRedirect("/login/complete");
    }

    /** properties.nickname(구) 또는 kakao_account.profile.nickname(신). 동의하지 않았으면 null */
    @SuppressWarnings("unchecked")
    static String nickname(OAuth2User kakao) {
        Object props = kakao.getAttributes().get("properties");
        if (props instanceof Map<?, ?> p && p.get("nickname") instanceof String n && !n.isBlank()) {
            return n;
        }
        Object account = kakao.getAttributes().get("kakao_account");
        if (account instanceof Map<?, ?> a && a.get("profile") instanceof Map<?, ?> profile
                && profile.get("nickname") instanceof String n && !n.isBlank()) {
            return n;
        }
        return null;
    }
}
