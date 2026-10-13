// 지도 데이터 생성기. 실행: npm run gen:map
//
// 만드는 파일 (둘 다 생성 파일이라 직접 고치지 않는다):
//   src/features/map/worldLand.ts      세계 육지 윤곽 (Natural Earth 1:50m land)
//   src/features/map/countryShapes.ts  나라별 영역 + 확대할 때 쓸 상자 (Natural Earth 1:50m countries)
//
// 원본: Natural Earth (퍼블릭 도메인) 를 npm `world-atlas`(ISC)로 받아 `topojson-client`(ISC)로 푼다.
// 좌표계: 등장방형. x = 경도 + 180, y = 90 - 위도 (viewBox 0 0 360 180). 소수점 1자리, 0.5 이내로 붙은 점은 합친다.
//
// 나라를 추가하면 아래 NUMERIC_CODES에 "ISO 3166-1 alpha-2 -> 숫자 코드(3자리)"를 한 줄 추가하고 다시 실행하세요.
// (숫자 코드는 https://github.com/mledoze/countries 의 ccn3 또는 ISO 3166-1 표에서 확인)
import fs from 'node:fs';
import { feature } from 'topojson-client';

const ROOT = new URL('..', import.meta.url);
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, ROOT), 'utf8'));
const write = (rel, text) => fs.writeFileSync(new URL(rel, ROOT), text);

const NUMERIC_CODES = {
  KR: '410', JP: '392', CN: '156', IN: '356', TH: '764', VN: '704', TR: '792', RU: '643', FR: '250', GB: '826',
  DE: '276', IT: '380', ES: '724', GR: '300', EG: '818', KE: '404', MA: '504', US: '840', CA: '124', MX: '484',
  BR: '076', AR: '032', PE: '604', AU: '036', NZ: '554', NL: '528', ZA: '710', ID: '360', PH: '608', MN: '496',
  NP: '524', BT: '064', PK: '586', NO: '578', FI: '246', IS: '352', ET: '231', MG: '450', UG: '800', NA: '516',
  CR: '188', CU: '192', EC: '218', CL: '152', CO: '170', FJ: '242',
};

const MIN_GAP = 0.5; // 이보다 가까운 점은 생략
const r1 = (n) => Math.round(n * 10) / 10;

/** 날짜변경선(±180°)을 넘는 고리는 경도를 이어 붙인다. */
function unwrap(ring) {
  let prev = null;
  let shift = 0;
  return ring.map(([lon, lat]) => {
    if (prev !== null) {
      const d = lon - prev;
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
    }
    prev = lon;
    return [lon + shift, lat];
  });
}

/** 이어 붙인 고리가 -180~180 밖으로 나가면 반대편에도 한 번 더 그려야 하므로 필요한 경도 이동값 목록 */
function offsetsFor(unwrapped) {
  const lons = unwrapped.map((p) => p[0]);
  const offsets = [0];
  if (Math.max(...lons) > 180) offsets.push(-360);
  if (Math.min(...lons) < -180) offsets.push(360);
  return offsets;
}

/** 고리 하나를 SVG 경로 조각들로 (점이 너무 적으면 버림). 점 수를 함께 센다. */
function ringToPath(unwrapped, offset) {
  const pts = [];
  for (const [lon, lat] of unwrapped) {
    const x = r1(lon + offset + 180);
    const y = r1(90 - lat);
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - x) + Math.abs(last[1] - y) < MIN_GAP) continue;
    pts.push([x, y]);
  }
  return pts.length >= 4 ? { d: 'M' + pts.map((p) => p.join(',')).join(' ') + 'Z', count: pts.length } : null;
}

const polygonsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);
const area = (ring) => {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

// ---- 1) 세계 육지 ----
{
  const topo = read('node_modules/world-atlas/land-50m.json');
  const land = feature(topo, topo.objects.land);
  const geometries = land.type === 'FeatureCollection' ? land.features.map((f) => f.geometry) : [land.geometry ?? land];
  let d = '';
  let points = 0;
  for (const g of geometries) {
    for (const polygon of polygonsOf(g)) {
      for (const ring of polygon) {
        if (ring.every(([, lat]) => lat < -58)) continue; // 남극 제외
        const un = unwrap(ring);
        for (const off of offsetsFor(un)) {
          const p = ringToPath(un, off);
          if (p) {
            d += p.d;
            points += p.count;
          }
        }
      }
    }
  }
  write(
    'src/features/map/worldLand.ts',
    `// 자동 생성 파일(npm run gen:map): Natural Earth 1:50m land (퍼블릭 도메인), world-atlas 2.0.2 (ISC)를 변환했다.\n` +
      `// 좌표계: 등장방형, x = 경도 + 180, y = 90 - 위도 (viewBox 0 0 360 180). 남극은 제외.\n` +
      `export const WORLD_LAND_PATH =\n  '${d}';\n`,
  );
  console.log(`worldLand.ts: ${points}점, ${(d.length / 1024).toFixed(0)}KB`);
}

// ---- 2) 나라별 영역 ----
{
  const topo = read('node_modules/world-atlas/countries-50m.json');
  // 같은 숫자 코드를 쓰는 항목(예: 호주와 애시모어 카르티에 제도가 둘 다 036)은 한 나라로 합친다.
  // (Map에 그냥 넣으면 나중 항목이 앞의 나라를 덮어써서 호주가 사라진다.)
  const features = new Map();
  for (const f of feature(topo, topo.objects.countries).features) {
    if (f.id === undefined) continue; // 코드가 없는 지역(코소보 등)은 쓰지 않는다
    const key = String(f.id).padStart(3, '0');
    features.set(key, [...(features.get(key) ?? []), f]);
  }
  const entries = [];
  let points = 0;
  for (const [id, code] of Object.entries(NUMERIC_CODES)) {
    const parts = features.get(code);
    if (!parts) throw new Error(`${id}(${code}): world-atlas에 없는 나라`);
    let d = '';
    const mains = []; // 큰 땅덩어리들의 상자 (작은 섬/해외 영토 때문에 확대 범위가 터무니없이 커지지 않게)
    const polygons = parts
      .flatMap((f) => polygonsOf(f.geometry))
      .map((polygon) => ({ polygon, size: area(unwrap(polygon[0])) }));
    const biggest = Math.max(...polygons.map((p) => p.size));
    for (const { polygon, size } of polygons) {
      const outer = unwrap(polygon[0]);
      if (size >= biggest * 0.25) {
        const xs = outer.map((p) => p[0] + 180);
        const ys = outer.map((p) => 90 - p[1]);
        mains.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
      }
      for (const ring of polygon) {
        const un = unwrap(ring);
        for (const off of offsetsFor(un)) {
          const p = ringToPath(un, off);
          if (p) {
            d += p.d;
            points += p.count;
          }
        }
      }
    }
    const box = [
      Math.min(...mains.map((b) => b[0])),
      Math.min(...mains.map((b) => b[1])),
      Math.max(...mains.map((b) => b[2])),
      Math.max(...mains.map((b) => b[3])),
    ].map(r1);
    entries.push(`  ${id}: { box: [${box.join(', ')}], d: '${d}' },`);
  }
  write(
    'src/features/map/countryShapes.ts',
    `// 자동 생성 파일(npm run gen:map): Natural Earth 1:50m countries (퍼블릭 도메인), world-atlas 2.0.2 (ISC)를 변환했다.\n` +
      `// 좌표계는 worldLand.ts와 같다 (x = 경도 + 180, y = 90 - 위도). box는 큰 땅덩어리들의 [왼쪽, 위, 오른쪽, 아래] 상자로,\n` +
      `// 나라로 확대할 때 쓴다 (멀리 떨어진 작은 섬/해외 영토는 뺀다). 날짜변경선을 걸친 나라는 box가 360을 넘을 수 있다.\n` +
      `export type CountryShape = { box: [number, number, number, number]; d: string };\n\n` +
      `export const COUNTRY_SHAPES: Record<string, CountryShape> = {\n${entries.join('\n')}\n};\n`,
  );
  console.log(`countryShapes.ts: ${entries.length}개국, ${points}점`);
}
