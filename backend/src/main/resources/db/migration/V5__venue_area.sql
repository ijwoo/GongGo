-- 장소가 '서울 강남구'처럼 시·구 단위로만 알려진 공고: 그 지역의 대략 위치(지오코딩 결과)를 둔다.
-- 정확한 장소(confirmed)와 섞지 않는다. 지도에는 '대략 위치'로 따로 표시한다.
alter table announcements add column venue_area varchar(100);

alter table announcements drop constraint ck_venue_coordinates;
alter table announcements add constraint ck_venue_coordinates check (
    (venue_status = 'confirmed' and venue_lat is not null and venue_lng is not null)
    or (venue_status = 'tbd' and venue_area is not null and (venue_lat is null) = (venue_lng is null))
    or (venue_status <> 'confirmed' and venue_lat is null and venue_lng is null)
);

-- 카카오 로컬 API 결과 캐시. 같은 지역을 매번 묻지 않고, 못 찾은 결과도 남겨 반복 호출을 막는다
create table geocode_cache (
    query       varchar(200) primary key,
    found       boolean      not null,
    lat         double precision,
    lng         double precision,
    resolved_as varchar(200),
    fetched_at  timestamptz  not null default now()
);
