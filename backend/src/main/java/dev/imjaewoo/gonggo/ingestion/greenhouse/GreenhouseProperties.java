package dev.imjaewoo.gonggo.ingestion.greenhouse;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Greenhouse Job Board API(키 없음). 가져올 회사 게시판은 sources/greenhouse-boards.yml에 둔다.
 * 국내 개발 직군만 남기려고 근무지·직무명을 정규식으로 거른다(대소문자 무시).
 */
@ConfigurationProperties("gonggo.greenhouse")
public record GreenhouseProperties(
        boolean enabled,
        String endpoint,
        String locationPattern,
        String titlePattern,
        List<Board> boards) {

    /**
     * token: 게시판 주소의 회사 식별자(boards.greenhouse.io/{token}), name: 화면에 쓸 회사 이름,
     * homepage: 공고 페이지에 대표 이미지가 없을 때 대신 찾아볼 회사 홈페이지(선택)
     */
    public record Board(String token, String name, String homepage) {
    }

    public boolean configured() {
        return enabled && endpoint != null && boards != null && !boards.isEmpty();
    }
}
