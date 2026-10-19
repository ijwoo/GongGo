# 공고함 백엔드 설계

> 상태: **1단계 구현 완료(공고 데이터·수집·조회 API)**, 2~4단계는 설계만 있음.
> 이 문서는 2인 개발(프론트 1, 백엔드 1)을 기준으로 역할을 나눌 수 있게 쓴다.

## 1. 목표와 범위

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 공고를 DB에 저장하고, 공공 오픈 API에서 주기적으로 수집하며, 변경을 감지해 이력을 남기고, 웹이 API로 공고를 읽는다 | **구현** |
| 2 | 실제 로그인(OAuth)과 개인 데이터(관심·비교·일정·지원 현황·프로필) API. localStorage 데모 데이터 이전 | 설계 |
| 3 | 서버 알림: 영속 예약 작업, 중복 방지, 재시도, 변경 알림, 이메일 | 설계 |
| 4 | AI 조건 구조화(서버 전용), 교육 과정 API 추가, 운영자 등록 화면 | 설계 |

1단계가 끝나면 **공고 데이터는 실제 백엔드**, 개인 데이터는 여전히 브라우저 데모 저장소다. 화면은 같은 코드로 두 모드를 모두 지원한다.

## 2. 구성

```
[브라우저] ──► [Next.js (web)] ──서버에서 fetch──► [Spring Boot API] ──► [PostgreSQL]
                    │                                   │
                    │ API_BASE_URL 없으면 데모 저장소     ├─ 스케줄러: 수집(1일 1회) ─► 공공데이터포털
                    ▼                                   └─ (3단계) 알림 발송 작업
              개인 데이터: localStorage(1단계) → API(2단계)
```

- **web**: 저장소 루트의 Next.js 앱. 공고는 서버 컴포넌트에서 API를 호출해 받는다(브라우저가 API를 직접 부르지 않음 → CORS·키 노출 없음).
- **api**: `backend/` 의 Spring Boot 4 (Java 21, Spring MVC, Spring Data JPA, Flyway, Actuator).
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
| `id` (PK) | 공개 식별자. 데모는 slug, 수집 공고는 `{source}-{external_id}` |
| `source_id`, `external_id` | 출처와 출처 안의 고유 번호. **(source_id, external_id) 유일** → 같은 공고를 다시 수집해도 한 행 |
| `title`, `organizer_*`, `category`, `participation_mode`, `status` | 기본 정보 |
| `source_url`, `source_name`, `published_at`, `source_updated_at`, `last_checked_at` | 출처·시각 |
| `app_start_type / _at / _date` | 신청 시작. type = `datetime`·`date`·`tbd` |
| `deadline_type / _at / _date / _note` | 신청 마감. type = `datetime`·`date`·`rolling`·`untilBudget`·`tbd`. **시각이 없으면 `_date`만 채우고 `_at`은 비운다**(CHECK 제약으로 강제) |
| `deadline_sort_at` | 정렬 전용. 시각 미공지 마감은 그날의 끝(서울)으로 둔다. 화면에 쓰지 않는다 |
| `event_type / _start_at / _end_at / _start_date / _end_date` | 행사 일정. type = `dates`·`datetime`·`tbd`·`ongoing` |
| `venue_status / _name / _address / _district / _lat / _lng / _note / _platform` | 행사·교육 장소. 좌표는 `confirmed`일 때만 |
| `eligibility_regions`, `team_size`, `cost`, `support_amount`, `conditions`, `required_documents`, `check_points` (jsonb) | 조건·서류 등 |
| `content_version`, `content_hash` | 정규화 결과(SHA-256). 해시가 바뀌면 내용을 갱신하고, 그중 **사용자에게 알릴 변경(마감·장소·조건·취소)이 있을 때만** 버전을 올리고 revision을 남긴다. 제목 오타 수정 같은 변경은 버전을 올리지 않는다(관심 공고에 ‘변경됨’이 뜨지 않게) |

시점(`*_at`)은 `timestamptz`, 시각 없는 날짜(`*_date`)는 `date`로 저장한다(Asia/Seoul 기준 날짜). 둘을 섞지 않는 원칙은 웹과 같다.

**announcement_revisions** — `(announcement_id, version, kind)` 유일(한 번의 수집에서 마감과 장소가 함께 바뀌면 같은 버전에 두 건). `kind`(deadline·venue·conditions·cancel), `summary`, `before_text`, `after_text`, `changed_at`.

**raw_records** — 출처 응답 한 건을 그대로(`jsonb`) 저장. `(source_id, external_id, payload_hash)` 유일이라 같은 응답은 다시 쌓이지 않는다. 매핑을 고친 뒤 원본에서 다시 정규화할 수 있다.

**ingestion_runs** — 실행마다 시작·종료 시각, 상태(`running`·`succeeded`·`failed`), 가져온 수, 신규·변경·그대로 수, 오류 메시지.

**sources** — 출처별 이용 정책. 웹의 `SourcePolicy`와 같은 내용(`allowed_uses`, `attribution`, `allow_transform`, `permission_note`)을 DB로 옮긴 것.

### 3.2 개인 데이터 (2단계 설계)

| 표 | 핵심 열 | 비고 |
|---|---|---|
| `users` | `id`, `provider`, `provider_subject`, `created_at` | 이름·이메일은 필요할 때만. 비밀번호 없음(OAuth) |
| `user_profiles` | `user_id`, `interests`, `region`, `career`, `team_size`, `startup_years` | 웹 `UserProfile`과 같음 |
| `saved_announcements` | `(user_id, announcement_id)` PK, `saved_at`, `seen_version` | |
| `compare_selections` | `(user_id, announcement_id)`, `position` | 최대 3개는 서비스에서 검사 |
| `calendar_events` | `id`, `user_id`, `announcement_id?`, `kind`, `title`, 시각 열(종일/시각 분리), `source_version`, `memo` | `(user_id, announcement_id, kind)` 부분 유일(kind≠prep) → 중복 등록 방지 |
| `reminders` | `id`, `event_id`, `offset_type`, `offset_days`, `offset_time`, `channel` | |
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `link_kind`, `link_id`, `read_at`, `dedupe_key` | `(user_id, dedupe_key)` 유일 |
| `application_records` | `(user_id, announcement_id)`, `status`, `memo`, `checklist`(jsonb) | |
| `user_change_alert_prefs` | `user_id`, 종류별 on/off | |

모든 개인 데이터 조회·수정은 **세션의 user_id로만** 범위를 제한한다(경로의 id를 믿지 않는다). 알림 링크로 들어와도 다른 사람 데이터는 404.

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

### 4.2 개인 데이터 (2단계 설계)

`/api/me`, `/api/me/profile`, `/api/me/saved`, `/api/me/compare`, `/api/me/events`(+`/{id}/resolve-change`), `/api/me/notifications`(+`/read-all`), `/api/me/applications`. 웹의 순수 함수(`src/lib/personal-actions.ts`)에 있는 규칙을 서버 서비스로 옮기고, 같은 테스트 케이스를 JUnit으로 다시 쓴다.

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
  - `demo`: 웹 데모 데이터와 같은 34건(`backend/src/main/resources/demo/announcements.json`, `scripts/export-demo-data.ts`로 생성). **데모 공고가 하나도 없을 때만** 시작 시 한 번 넣고, 날짜는 시드의 anchor에서 `gonggo.demo.anchor-date`(비우면 서울 기준 오늘)로 옮긴다. 날마다 다시 넣으면 날짜가 바뀌어 가짜 변경 이력이 생기므로 정기 수집에서는 빠진다. API 키 없이 바로 화면을 볼 수 있게 하기 위함.
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
| 출처 | `ingestion/demo/DemoSourceAdapter`(+`DemoSeeder`), `ingestion/kstartup/KStartupSourceAdapter`(+`KStartupNormalizer`) |
| 스케줄 | `ingestion/IngestionScheduler` (`gonggo.ingestion.scheduler-enabled=false`로 끌 수 있음) |
| 조회 | `announcement/AnnouncementQueryService`, `AnnouncementSpecs`(필터·정렬), `api/AnnouncementController` |
| 기준 시각 | `common/ClockConfig` (`gonggo.clock.fixed-now`로 고정 — 시연·E2E) |

## 6. 변경 감지와 알림 (3단계 설계)

- 수집에서 revision이 생기면 `announcement_changed` 이벤트를 **같은 트랜잭션에서 outbox 표**에 쓴다.
- 알림 작업자가 outbox를 읽어, 그 공고를 저장했거나 일정에 연결한 사용자에게 변경 알림을 만든다(사용자 설정 반영, `dedupe_key = change:{announcementId}:v{version}`).
- 일정 알림은 `reminder_jobs`(fire_at, dedupe_key, status, attempts, last_error)로 영속 예약한다. 작업자는 `SELECT … FOR UPDATE SKIP LOCKED`로 가져가고, **보내기 직전에 일정·알림 설정을 다시 읽어** 바뀌었으면 건너뛴다.
- `dedupe_key = {eventId}:{reminderId}:{channel}:{timingKey}` — 웹과 같은 규칙. 일정 시각이 바뀌면 키가 바뀌어 이전 예약은 자연히 무효가 된다.
- 실패는 지수 백오프로 최대 5회 재시도, 이후 `failed`로 남기고 알림 센터에 ‘발송 실패’로 보인다.
- 이메일은 `EmailSender` 인터페이스 뒤에 두고, 제공자의 idempotency key에 dedupe_key를 넘긴다.

## 7. 인증 (2단계 설계)

- Spring Security OAuth2 Login(카카오·GitHub 중 선택). 서버 세션(Spring Session JDBC) + `HttpOnly; Secure; SameSite=Lax` 쿠키.
- web은 같은 도메인의 `/api`로 프록시해 쿠키를 그대로 쓴다(별도 토큰 저장 없음). 상태 변경 요청은 CSRF 토큰 확인.
- 첫 로그인 때 웹이 localStorage의 데모 개인 데이터를 `/api/me/import`로 한 번 보내 이전한다(사용자 확인 후). 이후 localStorage 저장소는 읽지 않는다.

## 8. 시간대 정책

웹 README의 정책과 같다. 서버 JVM 시간대와 무관하게 `ZoneId.of("Asia/Seoul")`을 명시해 날짜를 계산하고, DB에는 `timestamptz`(UTC)와 `date`(서울 날짜)를 나눠 저장한다. ‘마감 시각 미공지’는 `deadline_type=date`이며 23:59로 바꾸지 않는다.

## 9. 운영

| 항목 | 값 |
|---|---|
| 환경변수(api) | `DB_URL`, `DB_USER`, `DB_PASSWORD`, `ADMIN_TOKEN`, `KSTARTUP_SERVICE_KEY`(선택), `GONGGO_INGESTION_CRON`(선택) |
| 환경변수(web) | `API_BASE_URL`(예: `http://api:8080`). 없으면 데모 저장소 |
| 백업 | `pg_dump` 일 1회 → S3(또는 Lightsail 스냅샷) |
| 관측 | Actuator health, 수집 실행 기록 API, 실패 시 로그 |
| 보안 | api·db 포트 외부 비공개, 관리자 API는 토큰 + (가능하면) IP 제한 |

## 10. 2인 역할 분담 예시

| 백엔드 | 프론트엔드 |
|---|---|
| 2단계 인증·개인 데이터 API, 3단계 알림 작업자 | `src/lib/personal-store.ts`를 API 호출로 교체, 로그인 화면, 데모 데이터 이전 UI |
| 출처 추가(고용24), 운영자 등록 API | 운영자 등록 화면, 서버 페이지네이션 목록·지도 마커 API 연동 |
