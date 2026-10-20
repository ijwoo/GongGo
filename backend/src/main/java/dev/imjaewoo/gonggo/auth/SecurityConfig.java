package dev.imjaewoo.gonggo.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

/**
 * 인증 정책
 * - 세션 쿠키(Spring Session JDBC, HttpOnly, SameSite=Lax). 브라우저에 토큰을 저장하지 않는다.
 * - 상태를 바꾸는 요청은 CSRF 토큰(XSRF-TOKEN 쿠키 → X-XSRF-TOKEN 헤더)을 확인한다.
 * - /api/me/** 는 로그인 필요. 로그인하지 않으면 리다이렉트 대신 401을 돌려준다(웹이 로그인 안내를 띄운다).
 * - /api/admin/** 은 세션이 아닌 X-Admin-Token으로 따로 확인하므로 CSRF 대상에서 뺀다.
 */
@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectProvider<ClientRegistrationRepository> clients,
            KakaoLoginSuccessHandler kakaoSuccess, LoginSessions sessions) throws Exception {
        http
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/me/**").authenticated()
                        .anyRequest().permitAll())
                .securityContext(c -> c.securityContextRepository(sessions.repository()))
                .csrf(c -> c
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .spa()
                        .ignoringRequestMatchers("/api/admin/**"))
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .logout(l -> l
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable);
        ClientRegistrationRepository kakao = clients.getIfAvailable();
        if (kakao != null) {
            http.oauth2Login(o -> o
                    .clientRegistrationRepository(kakao)
                    .authorizedClientRepository(new DiscardingAuthorizedClientRepository())
                    .successHandler(kakaoSuccess)
                    .failureHandler((req, res, ex) -> res.sendRedirect("/login?error=kakao")));
        }
        return http.build();
    }

    /** 로그인 뒤에는 카카오 API를 부르지 않으므로 카카오 토큰을 어디에도 저장하지 않는다 */
    static final class DiscardingAuthorizedClientRepository implements OAuth2AuthorizedClientRepository {

        @Override
        public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(String registrationId,
                Authentication principal, HttpServletRequest request) {
            return null;
        }

        @Override
        public void saveAuthorizedClient(OAuth2AuthorizedClient client, Authentication principal,
                HttpServletRequest request, HttpServletResponse response) {
        }

        @Override
        public void removeAuthorizedClient(String registrationId, Authentication principal,
                HttpServletRequest request, HttpServletResponse response) {
        }
    }
}
