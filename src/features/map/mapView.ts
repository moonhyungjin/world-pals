import type { Country } from '../../types/country';

/** 지도는 등장방형 360x180 좌표계: x = 경도 + 180, y = 90 - 위도 */
export type View = { x: number; y: number; w: number; h: number };

export const WORLD_VIEW: View = { x: 0, y: 0, w: 360, h: 180 };

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
  const x = Math.min(Math.max(cx - w / 2, 0), WORLD_VIEW.w - w);
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
