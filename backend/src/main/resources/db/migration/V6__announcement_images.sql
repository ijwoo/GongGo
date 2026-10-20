-- 공고 대표 이미지. 원문 페이지의 og:image 등을 수집 뒤에 따로 찾아 둔다.
-- 공고 내용(해시·버전)과 분리해, 이미지가 바뀌어도 변경 이력·알림이 생기지 않게 한다.
-- url이 null이면 찾아봤지만 없었다는 뜻이다(일정 기간 뒤 다시 찾는다).
create table announcement_images (
    announcement_id  varchar(80)   primary key references announcements (id) on delete cascade,
    url              varchar(1000),
    kind             varchar(10)   check (kind in ('photo', 'poster')),
    checked_at       timestamptz   not null
);
