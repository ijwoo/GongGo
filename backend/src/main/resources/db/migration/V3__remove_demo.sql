-- 데모 공고를 없앤다. 이제 공고는 실제 출처(Dev-Event, Greenhouse, K-Startup)에서만 들어온다.
delete from announcements where source_id = 'demo';
delete from raw_records where source_id = 'demo';
delete from ingestion_runs where source_id = 'demo';
delete from sources where id = 'demo';
