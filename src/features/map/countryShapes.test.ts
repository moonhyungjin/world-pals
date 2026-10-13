import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { COUNTRY_SHAPES } from './countryShapes';
import { EAST_OVERHANG, focusView, mixView, project, toPercent, toPercentRaw, WORLD_VIEW } from './mapView';

const all = content.countries;

describe('나라별 영역 데이터', () => {
  it('모든 나라에 영역이 있다 (나라를 추가하면 npm run gen:map을 다시 돌려야 함)', () => {
    for (const c of all) expect(COUNTRY_SHAPES[c.id], `${c.id} ${c.nameKo}`).toBeTruthy();
  });
  it('영역 경로와 상자 형식이 올바르다', () => {
    for (const [id, s] of Object.entries(COUNTRY_SHAPES)) {
      expect(s.d.startsWith('M'), id).toBe(true);
      expect(s.d.endsWith('Z'), id).toBe(true);
      const [x0, y0, x1, y1] = s.box;
      expect(x1, id).toBeGreaterThan(x0);
      expect(y1, id).toBeGreaterThan(y0);
      expect(y0, id).toBeGreaterThanOrEqual(0);
      expect(y1, id).toBeLessThanOrEqual(180);
    }
  });
  it('수도 좌표가 그 나라의 영역 상자 안에 있다 (나라 코드가 엉뚱한 나라와 연결되지 않았는지 확인)', () => {
    for (const c of all) {
      const p = project(c)!;
      const [x0, y0, x1, y1] = COUNTRY_SHAPES[c.id].box;
      const pad = 1.5; // 도
      // 날짜변경선을 걸친 나라는 상자가 360을 넘을 수 있어서 반대편 값도 본다
      const xs = [p.x, p.x + 360];
      const inX = xs.some((x) => x >= x0 - pad && x <= x1 + pad);
      expect(inX && p.y >= y0 - pad && p.y <= y1 + pad, `${c.id} ${c.nameKo} 수도(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) 상자 ${COUNTRY_SHAPES[c.id].box}`).toBe(true);
    }
  });
  it('데이터 크기가 지나치게 커지지 않는다 (지도 탭을 열 때 받는 양)', () => {
    const total = Object.values(COUNTRY_SHAPES).reduce((n, s) => n + s.d.length, 0);
    expect(total).toBeLessThan(260 * 1024);
  });
});

describe('focusView (나라로 확대)', () => {
  it('항상 2:1 비율이고 세계 범위 안에 있다', () => {
    for (const c of all) {
      const v = focusView(COUNTRY_SHAPES[c.id].box);
      expect(v.w / v.h, c.id).toBeCloseTo(2);
      expect(v.x, c.id).toBeGreaterThanOrEqual(0);
      expect(v.y, c.id).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w, c.id).toBeLessThanOrEqual(360 + EAST_OVERHANG + 1e-9);
      expect(v.y + v.h, c.id).toBeLessThanOrEqual(180 + 1e-9);
    }
  });
  it('나라의 수도가 확대된 영역 안에 보인다', () => {
    for (const c of all) {
      const v = focusView(COUNTRY_SHAPES[c.id].box);
      const pos = toPercent(c, v);
      // 날짜변경선 근처(피지 등)는 영역 안쪽 가장자리일 수 있어서 위치만 확인
      expect(pos, `${c.id} ${c.nameKo}`).not.toBeNull();
    }
  });
  it('날짜변경선에 걸친 나라(피지)는 영역 전체가 보이도록 지도 오른쪽 끝 너머까지 확대 영역이 이어진다', () => {
    const [x0, , x1] = COUNTRY_SHAPES.FJ.box;
    expect(x1).toBeGreaterThan(359); // 큰 섬들이 날짜변경선(x=360) 바로 옆에 있다
    const v = focusView(COUNTRY_SHAPES.FJ.box);
    expect(v.x + v.w).toBeGreaterThan(360); // 확대 영역이 지도 오른쪽 끝 너머로 이어져서
    expect(v.x).toBeLessThanOrEqual(x0);
    expect(v.x + v.w).toBeGreaterThanOrEqual(x1);
    // 나라가 확대 영역의 한가운데 근처에 온다 (반쪽만 보이지 않음)
    const center = (x0 + x1) / 2;
    expect(Math.abs(v.x + v.w / 2 - center)).toBeLessThan(1);
  });
  it('작은 나라도 최소 폭(26도) 만큼은 보여주고, 아주 큰 나라는 세계 전체까지만', () => {
    expect(focusView([100, 80, 101, 81]).w).toBe(26);
    expect(focusView([0, 10, 360, 80]).w).toBe(WORLD_VIEW.w);
  });
  it('나라 상자 전체가 보인다 (너무 크지 않을 때)', () => {
    const v = focusView([250, 60, 290, 90]);
    expect(v.x).toBeLessThanOrEqual(250);
    expect(v.x + v.w).toBeGreaterThanOrEqual(290);
    expect(v.y).toBeLessThanOrEqual(60);
    expect(v.y + v.h).toBeGreaterThanOrEqual(90);
  });
});

describe('애니메이션 도우미', () => {
  it('toPercentRaw는 영역 밖이어도 값을 돌려준다 (움직이는 중에 마커가 따라가게)', () => {
    const outside = { x: 0, y: 0, w: 10, h: 5 };
    expect(toPercent({ latitude: 0, longitude: 0 }, outside)).toBeNull();
    const raw = toPercentRaw({ latitude: 0, longitude: 0 }, outside)!;
    expect(raw.left).toBeGreaterThan(100);
    expect(toPercentRaw({}, outside)).toBeNull();
  });
  it('mixView는 양 끝과 가운데를 정확히 섞는다', () => {
    const a = { x: 0, y: 0, w: 360, h: 180 };
    const b = { x: 100, y: 40, w: 40, h: 20 };
    expect(mixView(a, b, 0)).toEqual(a);
    expect(mixView(a, b, 1)).toEqual(b);
    expect(mixView(a, b, 0.5)).toEqual({ x: 50, y: 20, w: 200, h: 100 });
  });
});
