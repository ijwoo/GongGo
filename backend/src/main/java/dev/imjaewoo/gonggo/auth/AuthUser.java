package dev.imjaewoo.gonggo.auth;

import java.io.Serializable;

/** 세션에 저장되는 로그인 사용자. 카카오 토큰·개인정보는 담지 않는다 */
public record AuthUser(long id, String nickname) implements Serializable {
}
