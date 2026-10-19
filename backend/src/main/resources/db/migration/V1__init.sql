-- 공고 데이터(1단계). 시점은 timestamptz, 시각 없는 날짜는 date(서울 기준)로 나눠 저장한다.

create table sources (
    id                varchar(40) primary key,
    name              varchar(100) not null,
    base_url          varchar(500),
    allowed_uses      jsonb        not null default '[]',
    attribution       varchar(300) not null,
    allow_transform   boolean      not null,
    permission_note   varchar(1000) not null,
    created_at        timestamptz  not null default now()
);

create table announcements (
    id                 varchar(80) primary key,
    source_id          varchar(40)  not null references sources (id),
    external_id        varchar(120) not null,
    title              varchar(300) not null,
    organizer_name     varchar(200) not null,
    organizer_address  varchar(300),
    organizer_color    varchar(20)  not null,
    category           varchar(20)  not null check (category in ('hackathon', 'startup', 'education', 'event')),
    participation_mode varchar(10)  not null check (participation_mode in ('online', 'offline', 'hybrid')),
    status             varchar(10)  not null check (status in ('active', 'cancelled')),
    source_url         varchar(1000) not null,
    source_name        varchar(200) not null,
    published_at       timestamptz  not null,
    source_updated_at  timestamptz  not null,
    last_checked_at    timestamptz  not null,

    app_start_type     varchar(10)  not null check (app_start_type in ('datetime', 'date', 'tbd')),
    app_start_at       timestamptz,
    app_start_date     date,

    deadline_type      varchar(12)  not null check (deadline_type in ('datetime', 'date', 'rolling', 'untilBudget', 'tbd')),
    deadline_at        timestamptz,
    deadline_date      date,
    deadline_note      varchar(300),
    -- 정렬용. 시각 미공지 마감은 그날의 끝(서울)으로 둔다. 화면에는 쓰지 않는다
    deadline_sort_at   timestamptz,

    event_type         varchar(10)  not null check (event_type in ('dates', 'datetime', 'tbd', 'ongoing')),
    event_start_at     timestamptz,
    event_end_at       timestamptz,
    event_start_date   date,
    event_end_date     date,

    venue_status       varchar(10)  not null check (venue_status in ('confirmed', 'tbd', 'online')),
    venue_name         varchar(200),
    venue_address      varchar(300),
    venue_district     varchar(100),
    venue_lat          double precision,
    venue_lng          double precision,
    venue_note         varchar(300),
    venue_platform     varchar(100),

    eligibility_regions jsonb not null default '[]',
    team_size           jsonb,
    cost                jsonb,
    support_amount      jsonb,
    conditions          jsonb not null default '[]',
    required_documents  jsonb not null default '[]',
    check_points        jsonb not null default '[]',

    content_version    integer      not null check (content_version > 0),
    content_hash       varchar(64)     not null,
    created_at         timestamptz  not null default now(),
    updated_at         timestamptz  not null default now(),

    constraint uq_announcements_source_external unique (source_id, external_id),
    -- 시각이 있는 마감은 at만, 날짜만 있는 마감은 date만 채운다(23:59 같은 값으로 바꾸지 않는다)
    constraint ck_deadline_shape check (
        (deadline_type = 'datetime' and deadline_at is not null and deadline_date is null)
        or (deadline_type = 'date' and deadline_date is not null and deadline_at is null)
        or (deadline_type in ('rolling', 'untilBudget', 'tbd') and deadline_at is null and deadline_date is null)
    ),
    -- 좌표는 장소가 확정됐을 때만
    constraint ck_venue_coordinates check (
        (venue_status = 'confirmed' and venue_lat is not null and venue_lng is not null)
        or (venue_status <> 'confirmed' and venue_lat is null and venue_lng is null)
    )
);

create index ix_announcements_deadline on announcements (deadline_sort_at);
create index ix_announcements_published on announcements (published_at desc);
create index ix_announcements_category on announcements (category);

create table announcement_revisions (
    id               varchar(120) primary key,
    announcement_id  varchar(80)  not null references announcements (id) on delete cascade,
    version          integer      not null,
    kind             varchar(12)  not null check (kind in ('deadline', 'venue', 'conditions', 'cancel')),
    summary          varchar(300) not null,
    before_text      varchar(2000) not null,
    after_text       varchar(2000) not null,
    changed_at       timestamptz  not null,
    constraint uq_revision unique (announcement_id, version, kind)
);

create table raw_records (
    id            bigserial primary key,
    source_id     varchar(40)  not null references sources (id),
    external_id   varchar(120) not null,
    payload       jsonb        not null,
    payload_hash  varchar(64)     not null,
    fetched_at    timestamptz  not null,
    constraint uq_raw_records unique (source_id, external_id, payload_hash)
);

create table ingestion_runs (
    id             bigserial primary key,
    source_id      varchar(40)  not null references sources (id),
    trigger        varchar(10)  not null check (trigger in ('schedule', 'manual', 'startup')),
    status         varchar(10)  not null check (status in ('running', 'succeeded', 'failed')),
    started_at     timestamptz  not null,
    finished_at    timestamptz,
    fetched_count  integer      not null default 0,
    created_count  integer      not null default 0,
    changed_count  integer      not null default 0,
    unchanged_count integer     not null default 0,
    error_count    integer      not null default 0,
    error_message  varchar(4000)
);

create index ix_ingestion_runs_source on ingestion_runs (source_id, started_at desc);

insert into sources (id, name, base_url, allowed_uses, attribution, allow_transform, permission_note) values
('demo', '데모 공고 게시판', 'https://example.com', '["display", "link"]',
 '데모 데이터 · 실제 공고가 아닙니다', true,
 '포트폴리오 시연용으로 직접 만든 가상 공고입니다. 실제 기관·행사와 관계없습니다.'),
('kstartup', 'K-Startup 사업공고 (창업진흥원)', 'https://www.k-startup.go.kr', '["display", "link"]',
 '출처: 창업진흥원 K-Startup, 공공데이터포털', true,
 '공공데이터포털 오픈 API. 이용허락범위는 데이터셋 페이지의 표시를 따르며, 원문 링크와 출처를 함께 표시합니다.');
