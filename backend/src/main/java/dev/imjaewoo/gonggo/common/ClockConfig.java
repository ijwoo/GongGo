package dev.imjaewoo.gonggo.common;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/** 서버 기준 시각. 시연·E2E에서는 gonggo.clock.fixed-now(ISO)로 고정한다 */
@Configuration
class ClockConfig {

    @Bean
    Clock clock(@Value("${gonggo.clock.fixed-now:}") String fixedNow) {
        if (StringUtils.hasText(fixedNow)) {
            return Clock.fixed(Instant.parse(fixedNow), ZoneOffset.UTC);
        }
        return Clock.systemUTC();
    }
}
