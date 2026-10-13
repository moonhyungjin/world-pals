import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { WORLD_VIEW, project, regionView, toPercent } from './mapView';

const verified = content.countries.filter((c) => c.status === 'verified');

describe('mapView', () => {
  it('등장방형 좌표: 경도 0·위도 0은 지도 중앙', () => {
    expect(project({ latitude: 0, longitude: 0 })).toEqual({ x: 180, y: 90 });
    expect(toPercent({ latitude: 0, longitude: 0 }, WORLD_VIEW)).toEqual({ left: 50, top: 50 });
  });
  it('좌표가 없는 국가는 지도에 표시하지 않는다', () => {
    expect(toPercent({}, WORLD_VIEW)).toBeNull();
  });
  it('전체 보기에는 모든 출제 대상 국가가 들어온다', () => {
    for (const c of verified) expect(toPercent(c, regionView(verified, null))).not.toBeNull();
  });
  it('대륙 확대 영역은 2:1 비율이고 세계 범위를 벗어나지 않으며 그 대륙 국가를 모두 포함한다', () => {
    for (const continent of new Set(verified.map((c) => c.continent))) {
      const v = regionView(verified, continent);
      expect(v.w / v.h).toBeCloseTo(2);
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w).toBeLessThanOrEqual(360 + 1e-9);
      expect(v.y + v.h).toBeLessThanOrEqual(180 + 1e-9);
      for (const c of verified.filter((x) => x.continent === continent)) {
        expect(toPercent(c, v), `${continent} ${c.nameKo}`).not.toBeNull();
      }
    }
  });
  it('모든 국가가 같은 대륙 안에서 서로 겹치지 않을 만큼 떨어져 있다(확대 시 마커 분리)', () => {
    for (const continent of new Set(verified.map((c) => c.continent))) {
      const v = regionView(verified, continent);
      const pts = verified
        .filter((c) => c.continent === continent)
        .map((c) => ({ id: c.id, ...toPercent(c, v)! }));
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].left - pts[j].left, (pts[i].top - pts[j].top) * 2); // 2:1 박스 보정
          expect(d, `${pts[i].id}-${pts[j].id}`).toBeGreaterThan(3);
        }
      }
    }
  });
});
