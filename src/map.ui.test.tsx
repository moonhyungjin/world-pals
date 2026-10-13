// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { content } from './data/content';
import { COUNTRY_SHAPES } from './features/map/countryShapes';
import { EAST_OVERHANG, focusView } from './features/map/mapView';
import { STORAGE_KEYS } from './lib/storageKeys';

const PLAYABLE = content.countries.filter((c) => c.status === 'verified').length;

/** 움직임 줄이기 설정을 흉내 낸다 (켜면 확대가 즉시 일어나서 테스트가 시간에 기대지 않는다). */
const setReducedMotion = (on: boolean) =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  setReducedMotion(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SEED = {
  totalAnswered: 9,
  completedDates: ['2026-10-12'],
  discoveredCountryIds: ['KR', 'JP', 'AU', 'FJ', 'NP'],
  stampTiers: { KR: 'gold', JP: 'basic', AU: 'gold', FJ: 'gold', NP: 'basic' },
};
const openMap = async (extra: object = {}) => {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ ...SEED, ...extra }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /지도/ }));
  await screen.findByText(/나라 발견/);
};
const svg = () => document.querySelector('svg.map-svg')!;
const viewBox = () => svg().getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
const area = (id: string) => document.querySelector(`[data-country="${id}"]`)!;
const markers = () => Array.from(document.querySelectorAll('.map-marker'));

describe('지도: 나라 영역 색칠과 확대', () => {
  it('도장을 받은 나라만 영역이 칠해지고, 못 찾은 나라는 칠하지도 않는다', async () => {
    await openMap();
    const areas = Array.from(document.querySelectorAll('.country-area'));
    expect(areas).toHaveLength(5);
    expect(area('KR').classList.contains('gold')).toBe(true);
    expect(area('JP').classList.contains('basic')).toBe(true);
    // 못 찾은 나라(예: 칠레)는 영역 자체가 DOM에 없다 (모양이 힌트가 되지 않게)
    expect(document.querySelector('[data-country="CL"]')).toBeNull();
    expect(document.querySelector('[data-country="BR"]')).toBeNull();
    // 영역은 눈으로 누르는 용도라 스크린리더에서는 숨긴다 (마커/목록이 대신함)
    expect(area('KR').closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('영역을 누르면 그 나라로 확대되고 상세가 나온다. 닫으면 원래대로 돌아온다', async () => {
    await openMap();
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    fireEvent.click(area('KR'));
    const [x, y, w, h] = viewBox();
    expect(w).toBeLessThan(100);
    expect(w / h).toBeCloseTo(2);
    // KR의 큰 땅덩어리가 확대된 영역 안에 있다
    const [bx0, by0, bx1, by1] = COUNTRY_SHAPES.KR.box;
    expect(x).toBeLessThanOrEqual(bx0);
    expect(x + w).toBeGreaterThanOrEqual(bx1);
    expect(y).toBeLessThanOrEqual(by0);
    expect(y + h).toBeGreaterThanOrEqual(by1);
    expect(screen.getByText('서울')).toBeTruthy();
    expect(document.querySelector('.map-box')!.classList.contains('focused')).toBe(true);
    expect(area('KR').classList.contains('selected')).toBe(true);
    // 확대하면 그 나라 마커만 보인다
    expect(markers()).toHaveLength(1);
    expect(markers()[0].getAttribute('aria-label')).toContain('대한민국');
    // 이웃한 나라의 영역은 계속 칠해져 있다
    expect(area('JP')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    expect(screen.queryByText('서울')).toBeNull();
    expect(markers()).toHaveLength(PLAYABLE);
    expect(document.querySelector('.map-box')!.classList.contains('focused')).toBe(false);
  });

  it('마커나 목록 칩으로 발견한 나라를 골라도 확대된다', async () => {
    await openMap();
    fireEvent.click(screen.getByRole('button', { name: /일본, 기본 도장/ }));
    expect(viewBox()[2]).toBeLessThan(100);
    expect(screen.getByText('도쿄')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    fireEvent.click(screen.getByRole('button', { name: '아시아' }));
    const chip = within(screen.getByRole('list', { name: '아시아 나라 목록' })).getByRole('button', { name: /네팔/ });
    fireEvent.click(chip);
    expect(screen.getByText('카트만두')).toBeTruthy();
    expect(viewBox()[2]).toBeLessThan(100);
  });

  it('못 찾은 나라는 눌러도 확대되지 않고 이름도 나오지 않는다', async () => {
    await openMap();
    fireEvent.click(screen.getAllByRole('button', { name: '아직 발견 못한 나라' })[0]);
    expect(screen.getByText('???', { selector: 'h2' })).toBeTruthy();
    expect(viewBox()).toEqual([0, 0, 360, 180]); // 위치가 더 크게 드러나지 않음
    expect(document.querySelector('.map-box')!.classList.contains('focused')).toBe(false);
    expect(markers()).toHaveLength(PLAYABLE);
  });

  it('대륙 버튼을 누르면 나라 확대는 풀리고 그 대륙으로 바뀐다', async () => {
    await openMap();
    fireEvent.click(area('AU'));
    expect(screen.getByText('캔버라')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '유럽' }));
    expect(screen.queryByText('캔버라')).toBeNull();
    expect(document.querySelector('.map-box')!.classList.contains('focused')).toBe(false);
    expect(screen.getByRole('list', { name: '유럽 나라 목록' })).toBeTruthy();
  });

  it('날짜변경선 가까운 나라(피지)도 세계 범위 안에서 확대된다', async () => {
    await openMap();
    fireEvent.click(area('FJ'));
    const [x, y, w, h] = viewBox();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(360 + EAST_OVERHANG + 1e-9);
    expect(y + h).toBeLessThanOrEqual(180 + 1e-9);
    // 피지의 영역 전체(날짜변경선 너머 동쪽 섬까지)가 보인다
    expect(x + w).toBeGreaterThanOrEqual(COUNTRY_SHAPES.FJ.box[2]);
    // 지도를 오른쪽으로 이어 붙인 그림이 있다
    expect(document.querySelector('use[href="#map-layer"]')).toBeTruthy();
    expect(markers()).toHaveLength(1);
    expect(screen.getByText('수바')).toBeTruthy();
  });

  it('확대 영역은 focusView 계산과 같다', async () => {
    await openMap();
    fireEvent.click(area('AU'));
    const expected = focusView(COUNTRY_SHAPES.AU.box);
    expect(viewBox()).toEqual([expected.x, expected.y, expected.w, expected.h]);
  });

  it('움직임 줄이기를 끄면 부드럽게 움직여 목표 영역에 도착한다', async () => {
    setReducedMotion(false);
    await openMap();
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    fireEvent.click(area('KR'));
    const expected = focusView(COUNTRY_SHAPES.KR.box);
    // 도착할 때까지 (애니메이션 약 0.4초)
    await waitFor(() => expect(viewBox()).toEqual([expected.x, expected.y, expected.w, expected.h]), { timeout: 3000 });
    // 도착한 뒤에도 마커는 제 자리에 있다
    expect(markers()).toHaveLength(1);
    // 닫으면 다시 세계 전체로 부드럽게 돌아온다
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(viewBox()).toEqual([0, 0, 360, 180]), { timeout: 3000 });
  });

  it('영역 데이터가 없는 나라(새로 추가하고 gen:map을 아직 안 돌린 경우)도 앱이 멈추지 않고 수도 주변으로 확대된다', async () => {
    // 콘텐츠를 직접 바꿀 수 없으므로, 영역이 없을 때의 대체 동작은 단위 수준에서 확인한다: 한 나라의 영역을 지워 본다.
    const saved = COUNTRY_SHAPES.NP;
    delete (COUNTRY_SHAPES as Record<string, unknown>).NP;
    try {
      await openMap();
      expect(document.querySelector('[data-country="NP"]')).toBeNull(); // 칠하지는 못하지만
      fireEvent.click(screen.getByRole('button', { name: /네팔, 기본 도장/ })); // 마커로는 열린다
      expect(screen.getByText('카트만두')).toBeTruthy();
      expect(viewBox()[2]).toBeLessThan(100); // 수도 주변으로 확대
    } finally {
      (COUNTRY_SHAPES as Record<string, unknown>).NP = saved;
    }
  });

  it('기본 상태의 지도 마커 수와 범례가 그대로다', async () => {
    await openMap();
    expect(markers()).toHaveLength(PLAYABLE);
    expect(screen.getByRole('list', { name: '범례' })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.progress)).toBeTruthy();
  });
});
