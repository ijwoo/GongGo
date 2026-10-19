// MapLibre 6은 지도 계산용 Web Worker 파일을 따로 불러온다.
// 번들러가 이 경로를 자동으로 처리하지 못하므로 public/vendor로 복사해 정적 파일로 제공한다.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const target = join(process.cwd(), "public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"), join(target, "maplibre-gl-worker.mjs"));
console.log(`[copy-maplibre-worker] maplibre-gl ${version} worker → public/vendor/`);
