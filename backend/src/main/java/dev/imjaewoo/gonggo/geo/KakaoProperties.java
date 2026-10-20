package dev.imjaewoo.gonggo.geo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 카카오 개발자 앱 키. REST API 키는 로그인(client_id)과 로컬(주소 검색) API에 함께 쓴다.
 * 비어 있으면 로그인·지오코딩이 꺼진다(화면은 그 상태를 안내한다).
 */
@ConfigurationProperties("gonggo.kakao")
public record KakaoProperties(String restApiKey, String clientSecret, String localApiUrl) {

    public boolean hasRestKey() {
        return restApiKey != null && !restApiKey.isBlank();
    }

    public String localApiUrlOrDefault() {
        return localApiUrl == null || localApiUrl.isBlank() ? "https://dapi.kakao.com" : localApiUrl;
    }
}
