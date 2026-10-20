#!/usr/bin/env bash
# E2E용 백엔드를 띄운다: 새 PostgreSQL(도커) + API(테스트 고정 공고, 고정 시각, 테스트 로그인 켬).
# 실행할 때마다 DB를 새로 만든다(이전 실행의 사용자·변경이 남지 않게).
#   scripts/e2e-api.sh          # 띄우기 (API: http://localhost:8080)
#   scripts/e2e-api.sh stop     # 내리기
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/.e2e"
DB=gonggo-e2e-db
PORT="${E2E_API_PORT:-8080}"
mkdir -p "$STATE"

stop() {
  if [ -f "$STATE/api.pid" ]; then kill "$(cat "$STATE/api.pid")" 2>/dev/null || true; rm -f "$STATE/api.pid"; fi
  docker rm -f "$DB" >/dev/null 2>&1 || true
}
if [ "${1:-}" = "stop" ]; then stop; exit 0; fi
stop

docker run -d --name "$DB" -e POSTGRES_DB=gonggo -e POSTGRES_USER=gonggo -e POSTGRES_PASSWORD=gonggo -p 5434:5432 postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$DB" pg_isready -U gonggo -d gonggo >/dev/null 2>&1 && break; sleep 1; done

JAR="$(ls "$ROOT"/backend/build/libs/gonggo-api-*.jar 2>/dev/null | grep -v plain | head -1 || true)"
if [ -z "$JAR" ]; then (cd "$ROOT/backend" && ./gradlew -q bootJar); JAR="$(ls "$ROOT"/backend/build/libs/gonggo-api-*.jar | grep -v plain | head -1)"; fi
rm -f "$STATE/fixture-overrides.json"

DB_URL=jdbc:postgresql://localhost:5434/gonggo DB_USER=gonggo DB_PASSWORD=gonggo PORT="$PORT" \
  ADMIN_TOKEN=e2e-admin-token \
  GONGGO_FIXTURE_FILE="$ROOT/tests/fixtures/announcements.json" \
  GONGGO_FIXTURE_ANCHOR_DATE=2026-10-21 \
  GONGGO_FIXTURE_OVERRIDES="$STATE/fixture-overrides.json" \
  GONGGO_TEST_LOGIN_ENABLED=true \
  GONGGO_INGESTION_SCHEDULER=false GONGGO_DEVEVENT_ENABLED=false GONGGO_GREENHOUSE_ENABLED=false \
  KAKAO_REST_API_KEY= \
  nohup java -Dgonggo.clock.fixed-now=2026-10-21T01:00:00Z -jar "$JAR" >"$STATE/api.log" 2>&1 &
echo $! >"$STATE/api.pid"

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$PORT/actuator/health" >/dev/null; then echo "[e2e-api] http://localhost:$PORT (로그: .e2e/api.log)"; exit 0; fi
  sleep 1
done
echo "[e2e-api] API가 뜨지 않았습니다. .e2e/api.log를 확인하세요." >&2
exit 1
