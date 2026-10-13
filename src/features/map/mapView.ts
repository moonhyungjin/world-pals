import type { Country } from '../../types/country';

/** 지도는 등장방형 360x180 좌표계: x = 경도 + 180, y = 90 - 위도 */
export type View = { x: number; y: number; w: number; h: number };

export const WORLD_VIEW: View = { x: 0, y: 0, w: 360, h: 180 };

/**
 * 지도의 오른쪽 끝(날짜변경선) 너머로 보여줄 수 있는 폭(도). 피지처럼 날짜변경선에 걸친 나라가 반쪽만 보이지 않도록,
 * 지도를 오른쪽으로 이어 붙여서(MapPage가 같은 그림을 한 번 더 그린다) 그만큼 더 볼 수 있게 한다.
 */
export const EAST_OVERHANG = 60;

/** 왼쪽 끝 x를 지도 범위 안으로 맞춘다 (오른쪽은 이어 붙인 만큼 더 허용). */
export const clampX = (x: number, w: number) => Math.min(Math.max(x, 0), WORLD_VIEW.w + EAST_OVERHANG - w);

const MIN_W = 70; // 대륙 확대 시 최소 폭(도)
const PAD = 10;

export const project = (c: { latitude?: number; longitude?: number }) =>
  c.latitude === undefined || c.longitude === undefined ? null : { x: c.longitude + 180, y: 90 - c.latitude };

/** 대륙에 속한 국가들이 모두 들어오는 2:1 비율의 확대 영역. 좌표가 없으면 전체 지도. */
export function regionView(countries: Country[], continent: string | null): View {
  if (!continent) return WORLD_VIEW;
  const pts = countries
    .filter((c) => c.continent === continent)
    .map(project)
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length === 0) return WORLD_VIEW;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - PAD;
  const maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD;
  const maxY = Math.max(...ys) + PAD;
  let w = Math.max(maxX - minX, (maxY - minY) * 2, MIN_W);
  w = Math.min(w, WORLD_VIEW.w);
  const h = w / 2;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = clampX(cx - w / 2, w);
  const y = Math.min(Math.max(cy - h / 2, 0), WORLD_VIEW.h - h);
  return { x, y, w, h };
}

/** 영역 안의 위치를 컨테이너 기준 퍼센트로 바꾼다. 영역 밖이면 null. */
export function toPercent(c: { latitude?: number; longitude?: number }, view: View): { left: number; top: number } | null {
  const p = project(c);
  if (!p) return null;
  const left = ((p.x - view.x) / view.w) * 100;
  const top = ((p.y - view.y) / view.h) * 100;
  if (left < 0 || left > 100 || top < 0 || top > 100) return null;
  return { left, top };
}

// ---- 나라로 확대 ----

const FOCUS_MIN_W = 26; // 작은 나라도 주변이 보이도록 하는 최소 폭(도)
const FOCUS_SCALE = 1.7; // 나라 상자보다 이만큼 넉넉하게

/** 나라의 큰 땅덩어리 상자([왼쪽, 위, 오른쪽, 아래])를 감싸는 2:1 비율의 확대 영역. 세계 범위를 벗어나지 않는다. */
export function focusView(box: [number, number, number, number]): View {
  const [x0, y0, x1, y1] = box;
  const w = Math.min(Math.max((x1 - x0) * FOCUS_SCALE, (y1 - y0) * 2 * FOCUS_SCALE, FOCUS_MIN_W), WORLD_VIEW.w);
  const h = w / 2;
  const x = clampX((x0 + x1) / 2 - w / 2, w);
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), WORLD_VIEW.h - h);
  return { x, y, w, h };
}

/** 위치(퍼센트)를 영역 밖이어도 그대로 계산한다 (확대/이동 애니메이션 중에 마커를 따라가게 할 때). */
export function toPercentRaw(c: { latitude?: number; longitude?: number }, view: View): { left: number; top: number } | null {
  const p = project(c);
  return p ? { left: ((p.x - view.x) / view.w) * 100, top: ((p.y - view.y) / view.h) * 100 } : null;
}

/** 두 영역 사이를 t(0~1)만큼 섞는다. */
export function mixView(a: View, b: View, t: number): View {
  const m = (u: number, v: number) => u + (v - u) * t;
  return { x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), h: m(a.h, b.h) };
}

export const sameView = (a: View, b: View) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
