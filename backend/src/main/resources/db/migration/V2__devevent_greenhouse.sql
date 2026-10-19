-- 키 없이 받을 수 있는 출처 두 개와 '채용' 분류를 더한다.

alter table announcements drop constraint announcements_category_check;
alter table announcements add constraint announcements_category_check
    check (category in ('hackathon', 'startup', 'education', 'event', 'job'));

insert into sources (id, name, base_url, allowed_uses, attribution, allow_transform, permission_note) values
('devevent', 'Dev-Event (개발자 행사 모음)', 'https://github.com/brave-people/Dev-Event', '["display", "link"]',
 '출처: Dev-Event (github.com/brave-people/Dev-Event)', true,
 '커뮤니티가 관리하는 공개 목록(README). 저장소에 라이선스 표기가 없어 행사명·일정·주최·원문 링크만 표시하고 원문으로 연결합니다.'),
('greenhouse', 'Greenhouse 채용 공고', 'https://boards-api.greenhouse.io', '["display", "link"]',
 '출처: 각 회사 Greenhouse 채용 페이지', true,
 '회사가 공개한 Greenhouse Job Board API. 직무명·근무지·원문 링크만 표시하고 지원은 원문에서 합니다. 목록에서 내려간 공고는 마감으로 바꿉니다.');
