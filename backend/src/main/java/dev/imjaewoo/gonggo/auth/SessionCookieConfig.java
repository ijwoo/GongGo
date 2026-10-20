package dev.imjaewoo.gonggo.auth;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/** 로그인 세션 쿠키. 자바스크립트에서 읽을 수 없고(HttpOnly), 다른 사이트에서 보낸 요청에는 실리지 않는다(Lax) */
@Configuration
class SessionCookieConfig {

    static final Duration MAX_AGE = Duration.ofDays(30);

    @Bean
    CookieSerializer cookieSerializer(@Value("${gonggo.session.cookie-secure:false}") boolean secure) {
        DefaultCookieSerializer s = new DefaultCookieSerializer();
        s.setCookieName("GONGGO_SESSION");
        s.setCookiePath("/");
        s.setUseHttpOnlyCookie(true);
        s.setSameSite("Lax");
        s.setUseSecureCookie(secure);
        // 브라우저를 닫아도 로그인이 유지되게 한다. 서버 세션 만료(spring.session.timeout)와 같게 둔다
        s.setCookieMaxAge((int) MAX_AGE.toSeconds());
        return s;
    }
}
