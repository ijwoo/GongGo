package dev.imjaewoo.gonggo.auth;

import dev.imjaewoo.gonggo.geo.KakaoProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

/**
 * 카카오 로그인(OAuth 2.0). KAKAO_REST_API_KEY가 있을 때만 켜진다.
 * redirect_uri는 웹 주소 기준으로 만들어진다(웹이 X-Forwarded-* 헤더를 붙여 프록시하고, 서버가 그것을 믿는다).
 * 카카오 개발자 콘솔의 Redirect URI에 {웹 주소}/login/oauth2/code/kakao 를 등록해야 한다.
 */
@Configuration
@ConditionalOnExpression("'${gonggo.kakao.rest-api-key:}' != ''")
class KakaoLoginConfig {

    @Bean
    ClientRegistrationRepository clientRegistrationRepository(KakaoProperties kakao) {
        ClientRegistration.Builder b = ClientRegistration.withRegistrationId("kakao")
                .clientId(kakao.restApiKey())
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                // 닉네임만 받는다(동의 항목: 닉네임). 이메일·전화번호는 받지 않는다
                .scope("profile_nickname")
                .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                .tokenUri("https://kauth.kakao.com/oauth/token")
                .userInfoUri("https://kapi.kakao.com/v2/user/me")
                .userNameAttributeName("id")
                .clientName("카카오");
        if (kakao.clientSecret() != null && !kakao.clientSecret().isBlank()) {
            b.clientSecret(kakao.clientSecret()).clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST);
        } else {
            b.clientAuthenticationMethod(ClientAuthenticationMethod.NONE);
        }
        return new InMemoryClientRegistrationRepository(b.build());
    }
}
