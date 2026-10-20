package dev.imjaewoo.gonggo.auth;

import java.sql.Timestamp;
import java.time.Clock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** 사용자 계정. 카카오 회원번호(provider_subject)와 닉네임만 저장한다 */
@Repository
public class UserAccounts {

    private final JdbcClient jdbc;
    private final Clock clock;

    public UserAccounts(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** 처음이면 만들고, 이미 있으면 닉네임과 마지막 로그인 시각만 갱신한다 */
    @Transactional
    public AuthUser upsert(String provider, String subject, String nickname) {
        return jdbc.sql("""
                insert into users (provider, provider_subject, nickname, last_login_at) values (?, ?, ?, ?)
                on conflict (provider, provider_subject)
                do update set nickname = coalesce(excluded.nickname, users.nickname), last_login_at = excluded.last_login_at
                returning id, nickname""")
                .params(provider, subject, nickname, Timestamp.from(clock.instant()))
                .query((rs, i) -> new AuthUser(rs.getLong("id"), rs.getString("nickname")))
                .single();
    }

    public boolean exists(long id) {
        return jdbc.sql("select count(*) from users where id = ?").param(id).query(Long.class).single() > 0;
    }

    /** 탈퇴. 개인 데이터는 FK(on delete cascade)로 함께 지워진다 */
    @Transactional
    public void delete(long id) {
        jdbc.sql("delete from users where id = ?").param(id).update();
    }
}
