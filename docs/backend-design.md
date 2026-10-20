# 공고함 백엔드 설계

> 상태: **1단계(공고·수집·조회)와 2단계(카카오 로그인·개인 데이터) 구현, 3단계 중 공고 변경 알림 구현.** 일정 알림 서버 발송·이메일(3단계 나머지)과 4단계는 설계만 있음. 데모 데이터는 없앴다(테스트 고정 공고만 테스트에서 쓴다).
> 이 문서는 2인 개발(프론트 1, 백엔드 1)을 기준으로 역할을 나눌 수 있게 쓴다.

## 1. 목표와 범위

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 공고를 DB에 저장하고, 공공 오픈 API에서 주기적으로 수집하며, 변경을 감지해 이력을 남기고, 웹이 API로 공고를 읽는다 | **구현** |
| 2 | 카카오 로그인(OAuth)과 개인 데이터(관심·일정·알림·지원 현황·프로필·변경 알림 설정) API | **구현** |
| 3 | 서버 알림: 공고 변경 알림 / 일정 알림 영속 예약·재시도·이메일 | 변경 알림 **구현**, 나머지 설계 |
| 4 | AI 조건 구조화(서버 전용), 교육 과정 API 추가, 운영자 등록 화면 | 설계 |

공고·로그인·개인 데이터가 모두 백엔드에 있다. 웹은 백엔드 없이 동작하지 않는다.

## 2. 구성

```
[브라우저] ──► [Next.js (web)] ──공고: 서버에서 fetch──────────────► [Spring Boot API] ──► [PostgreSQL]
     │              │                                                 │  ├─ 세션(Spring Session JDBC)
     │              └─ /api/**·/oauth2/**·/login/oauth2/** 프록시 ──►  │  ├─ 스케줄러: 수집(1일 1회) ─► Dev-Event · Greenhouse · 공공데이터포털
     │                                                                │  └─ 지오코딩 ─► 카카오 로컬 API
     ├─ 카카오 로그인 화면(kauth.kakao.com) ◄── 리다이렉트 ──────────────┘
     └─ 카카오맵 SDK(dapi.kakao.com)
```

- **web**: 저장소 루트의 Next.js 앱. 공고는 서버 컴포넌트에서 API를 호출해 받는다. 로그인·개인 데이터는 브라우저가 **웹과 같은 주소**로 부르고 웹이 백엔드로 넘긴다(쿠키가 웹 주소에 붙음, CORS 없음). `/api/admin/**`은 넘기지 않는다.
- **api**: `backend/` 의 Spring Boot 4 (Java 21, Spring MVC, Spring Security·OAuth2 Client, Spring Session JDBC, Spring Data JPA·JdbcClient, Flyway, Actuator).
- **db**: PostgreSQL 17. 스키마는 Flyway로만 바꾼다.
- **배포(Lightsail 1대)**: `docker compose`로 db·api·web 세 컨테이너. web만 외부 포트(80/443은 앞단 프록시)로 열고, api·db는 내부 네트워크에만 둔다.

### 왜 이렇게 나눴나
- 수집·변경 감지·알림 같은 **배치와 스케줄 작업**을 웹 서버와 분리한다. 웹이 재시작돼도 수집은 영향이 없다.
- 백엔드 포트폴리오로서 도메인 모델, 트랜잭션 경계, 멱등 수집, 스케줄러, 테스트(Testcontainers)를 보여 줄 수 있다.
- 화면 쪽 도메인 타입(`src/domain/types.ts`)을 **API 응답 계약**으로 그대로 쓴다. 웹은 응답을 Zod로 검증하므로 백엔드가 계약을 어기면 바로 드러난다.

## 3. 데이터 모델

### 3.1 공고 (1단계)

```
sources ─┐
         │ 1:N
announcements ──1:N── announcement_revisions
         │
raw_records (수집 원본, 감사·재처리용)
ingestion_runs (수집 실행 기록)
```

**announcements** — 화면 계약(`Announcement`)을 정규화한 표. 검색·정렬·필터에 쓰는 값은 열로, 모양이 다양한 값(조건·서류·팀 규모·비용·지원 규모)은 `jsonb`로 둔다.

| 열 | 설명 |
|---|---|
| `id` (PK) | 공개 식별자. `{source}-{external_id}` (테스트 고정 공고는 slug) |
| `source_id`, `external_id` | 출처와 출처 안의 고유 번호. **(source_id, external_id) 유일** → 같은 공고를 다시 수집해도 한 행 |
| `title`, `organizer_*`, `category`, `participation_mode`, `status` | 기본 정보 |
| `source_url`, `source_name`, `published_at`, `source_updated_at`, `last_checked_at` | 출처·시각 |
| `app_start_type / _at / _date` | 신청 시작. type = `datetime`·`date`·`tbd` |
| `deadline_type / _at / _date / _note` | 신청 마감. type = `datetime`·`date`·`rolling`·`untilBudget`·`tbd`. **시각이 없으면 `_date`만 채우고 `_at`은 비운다**(CHECK 제약으로 강제) |
| `deadline_sort_at` | 정렬 전용. 시각 미공지 마감은 그날의 끝(서울)으로 둔다. 화면에 쓰지 않는다 |
| `event_type / _start_at / _end_at / _start_date / _end_date` | 행사 일정. type = `dates`·`datetime`·`tbd`·`ongoing` |
| `venue_status / _name / _address / _district / _lat / _lng / _note / _platform / _area` | 행사·교육 장소. `confirmed`는 정확한 좌표. `tbd`이면서 `venue_area`(예: ‘서울 강남구’)가 있으면 lat/lng는 그 지역의 **대략 위치**(V5, CHECK 제약) |
| `eligibility_regions`, `team_size`, `cost`, `support_amount`, `conditions`, `required_documents`, `check_points` (jsonb) | 조건·서류 등 |
| `content_version`, `content_hash` | 정규화 결과(SHA-256). 해시가 바뀌면 내용을 갱신하고, 그중 **사용자에게 알릴 변경(마감·장소·조건·취소)이 있을 때만** 버전을 올리고 revision을 남긴다. 제목 오타 수정 같은 변경은 버전을 올리지 않는다(관심 공고에 ‘변경됨’이 뜨지 않게) |

시점(`*_at`)은 `timestamptz`, 시각 없는 날짜(`*_date`)는 `date`로 저장한다(Asia/Seoul 기준 날짜). 둘을 섞지 않는 원칙은 웹과 같다.

**announcement_revisions** — `(announcement_id, version, kind)` 유일(한 번의 수집에서 마감과 장소가 함께 바뀌면 같은 버전에 두 건). `kind`(deadline·venue·conditions·cancel), `summary`, `before_text`, `after_text`, `changed_at`.

**raw_records** — 출처 응답 한 건을 그대로(`jsonb`) 저장. `(source_id, external_id, payload_hash)` 유일이라 같은 응답은 다시 쌓이지 않는다. 매핑을 고친 뒤 원본에서 다시 정규화할 수 있다.

**ingestion_runs** — 실행마다 시작·종료 시각, 상태(`running`·`succeeded`·`failed`), 가져온 수, 신규·변경·그대로 수, 오류 메시지.

**sources** — 출처별 이용 정책. 웹의 `SourcePolicy`와 같은 내용(`allowed_uses`, `attribution`, `allow_transform`, `permission_note`)을 DB로 옮긴 것.

### 3.2 개인 데이터 (2단계, 구현 — V4)

| 표 | 핵심 열 | 비고 |
|---|---|---|
| `users` | `id`, `provider`(kakao·test), `provider_subject`(카카오 회원번호), `nickname`, `alert_*`(변경 알림 종류 4개) | `(provider, provider_subject)` 유일. 비밀번호·이메일·카카오 토큰 없음 |
| `user_profiles` | `user_id` PK, `interests`(jsonb), `region`, `career`, `team_size`, `startup_years` | 웹 `UserProfile`과 같음 |
| `saved_announcements` | `(user_id, announcement_id)` PK, `saved_at`, `seen_version` | |
| `calendar_events` | `(user_id, id)` PK, `announcement_id?`, `kind`, `title`, `timing_type`(allDay·timed), `start_date/end_date/time_unknown` 또는 `start_at/end_at`, `source_version`, `memo` | `(user_id, announcement_id, kind)` 부분 유일(kind≠prep) → 중복 등록 409. 시각 열 조합은 CHECK |
| `event_reminders` | `(user_id, event_id, id)` PK, `offset_type`, `offset_days`, `offset_time`, `channel`, `position` | 일정과 함께 지워짐 |
| `notifications` | `(user_id, id)` PK, `type`, `title`, `body`, `read`, `link_kind/link_id`, `dedupe_key`, `delivery`, `failure_reason` | `(user_id, dedupe_key)` 유일. 사용자당 최근 200개 유지 |
| `application_records` | `(user_id, announcement_id)` PK, `status`, `memo`, `checklist`(jsonb) | |
| `sent_reminder_keys` | `(user_id, key)` PK | 이미 만든 일정 알림 키(최근 1000개) |
| `spring_session`, `spring_session_attributes` | Spring Session JDBC | 배포·재시작해도 로그인 유지 |

- 모든 개인 데이터 조회·수정은 **세션의 user_id로만** 범위를 제한한다. 클라이언트가 만든 id(UUID)를 쓰지만 키가 `(user_id, id)`라 같은 id를 다른 사용자가 써도 서로 닿지 않는다(테스트로 확인).
- 비교 선택(최대 3개)은 로그인 없이도 쓰는 임시 선택이라 서버에 두지 않고 브라우저에만 둔다.
- 탈퇴(`DELETE /api/me`)하면 `users` 행을 지우고 나머지는 FK `on delete cascade`로 함께 지워진다.

## 4. API

### 4.1 공고 (1단계, 구현)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/announcements` | 목록. 쿼리: `q, cat, region, mode, includeClosed, sort(deadline·recent), page, size(최대 500)` |
| GET | `/api/announcements/{id}` | 단건. 없으면 404(ProblemDetail) |
| POST | `/api/admin/ingestions/{sourceId}` | 수동 수집. `X-Admin-Token` 헤더 필요 |
| GET | `/api/admin/ingestions` | 최근 수집 실행 기록 |
| GET | `/actuator/health` | 상태 확인 |

응답 본문의 공고 객체는 웹 `announcementSchema`와 **필드명·모양이 같다**. 목록 응답:

```json
{ "items": [ /* Announcement */ ], "page": 0, "size": 50, "total": 34, "serverTime": "2026-10-21T01:00:00Z" }
```

- 날짜 필터의 기준 시각은 서버 시각(`serverTime`)이다. 웹은 이 값을 요청 기준 시각으로 써서 화면 전체의 날짜를 맞춘다.
- 잘못된 `page`·`size`·긴 검색어는 400(ProblemDetail). 허용하지 않는 `cat`·`region`·`mode` 값은 웹처럼 조용히 버린다.
- 서버 필터·정렬은 웹 `filterAnnouncements`·`sortAnnouncements`와 같은 규칙이다. `scripts/check-api-parity.ts`가 9개 조건에서 목록 순서까지 같은지 비교한다.
- 1단계에서 웹은 지도·요약 수치를 위해 `size=500`으로 전체를 받아 같은 필터 함수를 쓴다. 공고가 많아지면 2단계에서 목록은 서버 페이지네이션, 지도는 `/api/announcements/markers?bbox=` 로 나눈다.

### 4.2 로그인·개인 데이터 (2단계, 구현)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/auth/session` | `{authenticated, user, kakaoEnabled, testLoginEnabled}`. CSRF 쿠키(`XSRF-TOKEN`)도 여기서 받는다 |
| GET | `/oauth2/authorization/kakao` | 카카오 인증 화면으로 리다이렉트(PKCE, `scope=profile_nickname`) |
| GET | `/login/oauth2/code/kakao` | 카카오 콜백. 계정을 만들거나 찾아 세션을 만들고 웹 `/login/complete`로 보낸다 |
| POST | `/api/auth/logout` | 로그아웃(204) |
| POST | `/api/auth/test-login` | **테스트 전용**(`GONGGO_TEST_LOGIN_ENABLED=true`일 때만, 아니면 404) |
| GET | `/api/me` | 전체 개인 상태(웹 `PersonalState`와 같은 모양) |
| PUT·DELETE | `/api/me/profile`, `/api/me/saved/{announcementId}`, `/api/me/events/{id}`, `/api/me/applications/{announcementId}` | 자원 단위 저장·삭제(멱등). 경로 id와 본문 id가 다르면 400, 없는 공고는 404, 중복 일정 409 |
| PUT | `/api/me/notifications/{id}`, `/api/me/change-alerts` | 알림 만들기·읽음, 변경 알림 종류 |
| POST | `/api/me/notifications/read-all`, `/api/me/sent-reminders` | 모두 읽음, 보낸 일정 알림 키 기록 |
| DELETE | `/api/me` | 탈퇴(모든 데이터 삭제 후 로그아웃) |

- 로그인하지 않으면 `/api/me/**`는 리다이렉트 대신 **401**. 상태를 바꾸는 요청은 CSRF 토큰(`X-XSRF-TOKEN` 헤더)이 없으면 403.
- 요청 본문은 Bean Validation으로 검사한다(웹 Zod 스키마와 같은 범위: 길이, 알림 7·3·1·0일, 시각 형식 등).
- 웹은 화면에서 순수 함수(`src/lib/personal-actions.ts`)로 다음 상태를 만들고, 이전·다음 상태 차이(`src/lib/personal-sync.ts`)만 위 API로 보낸다. 서버가 거절하면 `GET /api/me`로 다시 맞춘다.

## 5. 수집 파이프라인 (1단계, 구현)

```
SourceAdapter.fetch()  ─►  raw_records 저장(중복 무시)
        │
        ▼
Normalizer.normalize(raw) ─► AnnouncementDraft (검증 실패 시 그 건만 오류로 기록)
        │
        ▼
AnnouncementUpserter
   ├─ 새 공고 → insert, version 1
   ├─ 해시 같음 → last_checked_at만 갱신
   └─ 해시 다름 → 필드 비교로 revision(마감·장소·조건·취소) 생성, version+1
        │
        ▼
ingestion_runs 에 결과 기록
```

- **멱등**: 같은 응답을 여러 번 수집해도 결과가 같다(유일 키 + 해시 비교). 실패 후 다시 돌려도 안전하다.
- **트랜잭션 경계**: 공고 한 건 단위. 한 건이 잘못돼도 나머지는 저장된다.
- **스케줄**: `gonggo.ingestion.cron`(기본 매일 06:10 KST). 같은 출처가 동시에 두 번 돌지 않도록 실행 중이면 건너뛴다(1대 운영 전제. 여러 대면 DB advisory lock).
- **출처**
  - `devevent`: Dev-Event README(커뮤니티 개발자 행사 목록). 키 없음. 장소가 ‘오프라인(서울 강남구)’처럼 시·구 단위라 `venue.area`로 둔다.
  - `greenhouse`: 회사별 Greenhouse 채용 게시판. 키 없음. 목록에서 내려간 공고는 마감 처리(`fullSnapshot`).
  - `fixture`(**테스트 전용**): `tests/fixtures/announcements.json`(34건, `scripts/export-fixtures.ts`로 생성). `GONGGO_FIXTURE_FILE`을 줄 때만 등록된다(백엔드 통합 테스트·E2E). 운영에는 없다. 데모 공고(`demo`)는 V3에서 지웠다.
- **지오코딩**: 정규화 뒤 `venue.area`가 있고 좌표가 없으면 카카오 로컬 API(주소 → 없으면 ‘시’를 붙여 → 키워드)로 대략 좌표를 찾는다. 결과(못 찾은 경우 포함)는 `geocode_cache`에 남기고, API 오류는 캐시하지 않고 좌표 없이 넘어가 수집을 막지 않는다. 좌표만 새로 생긴 것은 장소 변경 알림 대상이 아니다(장소 비교는 표기 기준).
  - `kstartup`: 공공데이터포털 **창업진흥원_K-Startup 사업공고 조회** API. `KSTARTUP_SERVICE_KEY`가 있을 때만 켜진다.

### 5.1 K-Startup 매핑 — 반드시 확인할 것

이 저장소를 만든 환경에서는 공공데이터포털에 접속할 수 없어 **응답 필드명을 직접 확인하지 못했다.**
그래서 필드명은 코드가 아니라 `backend/src/main/resources/sources/kstartup-mapping.yml`에 두었고,
현재 값은 확인 전 초안이다. 켜기 전에:

1. 공공데이터포털 데이터셋 15125364의 활용가이드(또는 실제 응답 1건)로 필드명·날짜 형식을 확인해 yml을 고친다.
2. `./gradlew test --tests '*KStartupNormalizerTest*'`의 픽스처를 **실제 응답 1건**으로 바꿔 통과시킨다.
3. 필수 필드(외부 ID·공고명·URL)가 응답에 없으면 그 실행은 `failed`로 끝나고 오류 메시지에 빠진 필드를 적는다 — 매핑이 틀리면 조용히 빈 데이터가 쌓이지 않고 바로 드러난다.

K-Startup 공고는 지원사업이므로 `category=startup`, 장소는 대부분 `online`(온라인 접수) 또는 `tbd`로 들어오고 **좌표를 만들지 않는다.** 마감 시각이 없으면 날짜만 저장한다.

### 5.2 추가 출처 후보 (4단계)
- 고용24(구 HRD-Net) 훈련과정 API → `education`
- 해커톤·개발자 행사는 이용 허락이 명확한 API가 드물어 **운영자 등록 화면**으로 채운다(출처 URL 필수, 출처 표시 문구 자동).
- 웹 크롤링은 출처별 약관·robots·허락을 확인하기 전에는 하지 않는다.

### 5.3 코드 위치

| 역할 | 클래스 |
|---|---|
| 출처 인터페이스 | `ingestion/SourceAdapter` (fetch · validate · normalize) |
| 실행·원본 보관·실행 기록 | `ingestion/IngestionService` (출처별 동시 실행 방지) |
| 한 건 저장(트랜잭션) | `announcement/AnnouncementUpserter` |
| 알릴 변경 판정·한국어 표기 | `announcement/RevisionDetector`, `model/Deadline#format`, `model/Venue#format` |
| 출처 | `ingestion/devevent/*`, `ingestion/greenhouse/*`, `ingestion/kstartup/*`, 테스트 전용 `ingestion/fixture/FixtureSourceAdapter` |
| 지오코딩 | `geo/AreaGeocoder`(+`KakaoLocalClient`) |
| 변경 알림 | `announcement/ChangeNotifier` |
| 로그인·세션 | `auth/SecurityConfig`, `auth/KakaoLoginConfig`, `auth/KakaoLoginSuccessHandler`, `auth/LoginSessions`, `auth/SessionCookieConfig` |
| 개인 데이터 | `me/MeController`, `me/PersonalDataService`(JdbcClient), `me/MeDtos` |
| 스케줄 | `ingestion/IngestionScheduler` (`gonggo.ingestion.scheduler-enabled=false`로 끌 수 있음) |
| 조회 | `announcement/AnnouncementQueryService`, `AnnouncementSpecs`(필터·정렬), `api/AnnouncementController` |
| 기준 시각 | `common/ClockConfig` (`gonggo.clock.fixed-now`로 고정 — 시연·E2E) |

## 6. 변경 감지와 알림 (3단계)

- **구현**: 수집에서 revision이 생기면 **공고 저장과 같은 트랜잭션에서** 그 공고를 저장했거나 일정에 연결한 사용자에게 알림 행을 바로 만든다(사용자 설정 `alert_*` 반영, `dedupe_key = change:{announcementId}:v{version}`, `on conflict do nothing`). 같은 수집을 다시 돌려도 알림이 늘지 않는다.
  - 이메일 등 외부 발송이 붙으면 이 자리에 outbox 표를 두고 작업자가 보내는 구조로 바꾼다(아래).
- **설계(미구현)**: 아래는 일정 알림 서버 발송·이메일 계획이다. 지금 일정 알림은 앱을 열 때 웹이 만들어 서버에 저장한다.
- 일정 알림은 `reminder_jobs`(fire_at, dedupe_key, status, attempts, last_error)로 영속 예약한다. 작업자는 `SELECT … FOR UPDATE SKIP LOCKED`로 가져가고, **보내기 직전에 일정·알림 설정을 다시 읽어** 바뀌었으면 건너뛴다.
- `dedupe_key = {eventId}:{reminderId}:{channel}:{timingKey}` — 웹과 같은 규칙. 일정 시각이 바뀌면 키가 바뀌어 이전 예약은 자연히 무효가 된다.
- 실패는 지수 백오프로 최대 5회 재시도, 이후 `failed`로 남기고 알림 센터에 ‘발송 실패’로 보인다.
- 이메일은 `EmailSender` 인터페이스 뒤에 두고, 제공자의 idempotency key에 dedupe_key를 넘긴다.

## 7. 인증 (2단계, 구현)

- Spring Security OAuth2 Client로 **카카오 로그인**(PKCE, 동의 항목은 닉네임만). 성공하면 카카오 회원번호로 `users`를 만들거나 찾고, 세션에는 우리 사용자(`AuthUser{id, nickname}`)만 넣는다. 카카오 access token은 어디에도 저장하지 않는다(로그인 뒤 카카오 API를 부르지 않음).
- 세션: Spring Session JDBC, 쿠키 `GONGGO_SESSION`(`HttpOnly`, `SameSite=Lax`, 30일, https면 `COOKIE_SECURE=true`로 `Secure`). 로그인할 때 세션 id를 바꾼다(세션 고정 방지).
- CSRF: `CookieCsrfTokenRepository`(`XSRF-TOKEN` 쿠키 → `X-XSRF-TOKEN` 헤더, SPA 모드). `/api/admin/**`은 토큰 헤더로 따로 확인하므로 제외.
- **redirect_uri**: 웹이 프록시하며 `X-Forwarded-Host/Proto/Port`를 붙이고 백엔드가 `forward-headers-strategy=framework`로 받아 `{baseUrl}/login/oauth2/code/kakao`를 웹 주소로 만든다. api 포트를 외부에 열지 않아야 이 헤더를 믿을 수 있다.
- 키가 없으면(`KAKAO_REST_API_KEY` 비어 있음) OAuth 설정 자체를 등록하지 않고, 화면은 ‘카카오 로그인이 아직 설정되지 않았어요’를 보여 준다.
- E2E·로컬용 테스트 로그인(`/api/auth/test-login`)은 같은 세션 경로를 쓰며 운영에서는 꺼져 있다(404).

## 8. 시간대 정책

웹 README의 정책과 같다. 서버 JVM 시간대와 무관하게 `ZoneId.of("Asia/Seoul")`을 명시해 날짜를 계산하고, DB에는 `timestamptz`(UTC)와 `date`(서울 날짜)를 나눠 저장한다. ‘마감 시각 미공지’는 `deadline_type=date`이며 23:59로 바꾸지 않는다.

## 9. 운영

| 항목 | 값 |
|---|---|
| 환경변수(api) | `DB_URL`, `DB_USER`, `DB_PASSWORD`, `ADMIN_TOKEN`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`(선택), `COOKIE_SECURE`, `KSTARTUP_SERVICE_KEY`(선택), `GONGGO_DEVEVENT_ENABLED`·`GONGGO_GREENHOUSE_ENABLED`(기본 켜짐), `GONGGO_INGESTION_CRON`(선택) |
| 환경변수(web) | `API_BASE_URL`(필수, 예: `http://api:8080`), `KAKAO_MAP_JS_KEY`(지도, 실행 시 읽음) |
| 테스트 전용(api) | `GONGGO_TEST_LOGIN_ENABLED`, `GONGGO_FIXTURE_FILE`, `GONGGO_FIXTURE_ANCHOR_DATE`, `GONGGO_FIXTURE_OVERRIDES` — 운영에서 켜지 않는다 |
| 백업 | `pg_dump` 일 1회 → S3(또는 Lightsail 스냅샷) |
| 관측 | Actuator health, 수집 실행 기록 API, 실패 시 로그 |
| 보안 | api·db 포트 외부 비공개, 관리자 API는 토큰 + (가능하면) IP 제한 |

## 10. 2인 역할 분담 예시

| 백엔드 | 프론트엔드 |
|---|---|
| 3단계 일정 알림 작업자·이메일, 실시간 동기화(선택) | 알림 설정 화면 확장, 다른 기기 변경 반영(포커스 시 다시 읽기) |
| 출처 추가(고용24), 운영자 등록 API | 운영자 등록 화면, 서버 페이지네이션 목록·지도 마커 API 연동 |
