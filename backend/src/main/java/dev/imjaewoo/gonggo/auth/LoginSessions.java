package dev.imjaewoo.gonggo.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

/** 로그인 성공 후 세션에 우리 사용자(AuthUser)를 넣는다. 카카오 인증 정보는 세션에 남기지 않는다 */
@Component
public class LoginSessions {

    private final SecurityContextRepository repository = new HttpSessionSecurityContextRepository();

    public void signIn(AuthUser user, HttpServletRequest request, HttpServletResponse response) {
        // 로그인 전 세션 id를 그대로 쓰지 않는다(세션 고정 공격 방지)
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        var auth = UsernamePasswordAuthenticationToken.authenticated(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        repository.saveContext(context, request, response);
    }

    public SecurityContextRepository repository() {
        return repository;
    }
}
