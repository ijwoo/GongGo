-- 2단계: 카카오 로그인 사용자와 개인 데이터.
-- 모든 개인 데이터 표는 (user_id, …)를 키로 가져 다른 사용자의 행을 경로 id로 건드릴 수 없게 한다.

create table users (
    id             bigserial primary key,
    provider       varchar(20)  not null check (provider in ('kakao', 'test')),
    provider_subject varchar(100) not null,
    nickname       varchar(100),
    created_at     timestamptz  not null default now(),
    last_login_at  timestamptz  not null default now(),
    -- 공고 변경 알림 종류(설정 화면)
    alert_deadline   boolean not null default true,
    alert_venue      boolean not null default true,
    alert_conditions boolean not null default true,
    alert_cancel     boolean not null default true,
    constraint uq_users_provider unique (provider, provider_subject)
);

create table user_profiles (
    user_id        bigint primary key references users (id) on delete cascade,
    interests      jsonb    not null default '[]',
    region         varchar(10),
    career         varchar(10),
    team_size      integer check (team_size between 1 and 50),
    startup_years  integer check (startup_years between 0 and 30),
    updated_at     timestamptz not null default now()
);

create table saved_announcements (
    user_id          bigint      not null references users (id) on delete cascade,
    announcement_id  varchar(80) not null references announcements (id) on delete cascade,
    saved_at         timestamptz not null,
    seen_version     integer     not null check (seen_version > 0),
    primary key (user_id, announcement_id)
);

create index ix_saved_announcement on saved_announcements (announcement_id);

create table calendar_events (
    user_id          bigint      not null references users (id) on delete cascade,
    id               varchar(64) not null,
    -- 공고가 지워져도 내 일정은 남긴다
    announcement_id  varchar(80) references announcements (id) on delete set null,
    kind             varchar(10) not null check (kind in ('deadline', 'event', 'prep')),
    title            varchar(80) not null,
    timing_type      varchar(10) not null check (timing_type in ('allDay', 'timed')),
    start_date       date,
    end_date         date,
    time_unknown     boolean,
    start_at         timestamptz,
    end_at           timestamptz,
    source_version   integer,
    memo             varchar(500) not null default '',
    created_at       timestamptz not null,
    updated_at       timestamptz not null,
    primary key (user_id, id),
    constraint ck_event_timing check (
        (timing_type = 'allDay' and start_date is not null and end_date is not null and time_unknown is not null
            and start_at is null and end_at is null)
        or (timing_type = 'timed' and start_at is not null and start_date is null and end_date is null)
    )
);

-- 같은 공고의 마감·행사 일정은 한 번만(준비 일정은 여러 개 가능)
create unique index uq_event_per_kind on calendar_events (user_id, announcement_id, kind)
    where kind <> 'prep' and announcement_id is not null;
create index ix_event_announcement on calendar_events (announcement_id);

create table event_reminders (
    user_id      bigint      not null,
    event_id     varchar(64) not null,
    id           varchar(64) not null,
    offset_type  varchar(10) not null check (offset_type in ('preset', 'custom')),
    offset_days  integer     not null check (offset_days between 0 and 60),
    offset_time  varchar(5),
    channel      varchar(10) not null check (channel in ('inApp', 'email')),
    position     integer     not null,
    primary key (user_id, event_id, id),
    foreign key (user_id, event_id) references calendar_events (user_id, id) on delete cascade
);

create table notifications (
    user_id         bigint       not null references users (id) on delete cascade,
    id              varchar(64)  not null,
    type            varchar(10)  not null check (type in ('reminder', 'change', 'system')),
    title           varchar(200) not null,
    body            varchar(1000) not null,
    created_at      timestamptz  not null,
    read            boolean      not null default false,
    link_kind       varchar(20) check (link_kind in ('announcement', 'event')),
    link_id         varchar(80),
    dedupe_key      varchar(300) not null,
    delivery        varchar(10)  not null check (delivery in ('delivered', 'failed')),
    failure_reason  varchar(300),
    primary key (user_id, id),
    -- 같은 알림을 두 번 만들지 않는다(웹·서버 모두 같은 키 규칙)
    constraint uq_notification_dedupe unique (user_id, dedupe_key)
);

create index ix_notifications_recent on notifications (user_id, created_at desc);

create table application_records (
    user_id          bigint      not null references users (id) on delete cascade,
    announcement_id  varchar(80) not null references announcements (id) on delete cascade,
    status           varchar(10) not null check (status in ('reviewing', 'preparing', 'submitted', 'closed')),
    memo             varchar(2000) not null default '',
    checklist        jsonb       not null default '[]',
    updated_at       timestamptz not null,
    primary key (user_id, announcement_id)
);

-- 이미 보낸 예약 알림 키(앱이 다시 열려도 같은 알림을 또 만들지 않게)
create table sent_reminder_keys (
    user_id   bigint       not null references users (id) on delete cascade,
    key       varchar(300) not null,
    sent_at   timestamptz  not null default now(),
    primary key (user_id, key)
);

-- Spring Session JDBC (spring-session-jdbc schema-postgresql.sql 그대로). 배포·재시작해도 로그인이 유지된다
create table spring_session (
    primary_id            char(36) not null,
    session_id            char(36) not null,
    creation_time         bigint   not null,
    last_access_time      bigint   not null,
    max_inactive_interval int      not null,
    expiry_time           bigint   not null,
    principal_name        varchar(100),
    constraint spring_session_pk primary key (primary_id)
);

create unique index spring_session_ix1 on spring_session (session_id);
create index spring_session_ix2 on spring_session (expiry_time);
create index spring_session_ix3 on spring_session (principal_name);

create table spring_session_attributes (
    session_primary_id char(36)     not null,
    attribute_name     varchar(200) not null,
    attribute_bytes    bytea        not null,
    constraint spring_session_attributes_pk primary key (session_primary_id, attribute_name),
    constraint spring_session_attributes_fk foreign key (session_primary_id)
        references spring_session (primary_id) on delete cascade
);
