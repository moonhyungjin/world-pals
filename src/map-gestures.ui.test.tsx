// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { content } from './data/content';
import { COUNTRY_SHAPES } from './features/map/countryShapes';
import { focusView, MIN_VIEW_W, project } from './features/map/mapView';
import { STORAGE_KEYS } from './lib/storageKeys';

const PLAYABLE = content.countries.filter((c) => c.status === 'verified').length;
// 지도 상자를 화면의 (100,50)에서 400x200 크기로 가정한다 (jsdom은 크기를 계산하지 않는다)
const RECT = { left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON: () => ({}) };

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  // 움직임 줄이기: 확대 이동이 즉시 일어나서 테스트가 시간에 기대지 않는다
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SEED = {
  totalAnswered: 9,
  completedDates: ['2026-10-12'],
  discoveredCountryIds: ['KR', 'JP', 'BR'],
  stampTiers: { KR: 'gold', JP: 'basic', BR: 'gold' },
};
const openMap = async () => {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(SEED));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /지도/ }));
  await screen.findByText(/나라 발견/);
};
const box = () => document.querySelector('.map-box') as HTMLElement;
const viewBox = () => document.querySelector('svg.map-svg')!.getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
const markers = () => Array.from(document.querySelectorAll('.map-marker'));
const button = (name: string) => screen.getByRole('button', { name });
const queryButton = (name: string) => screen.queryByRole('button', { name });

/** 포인터 이벤트를 흉내 낸다 (jsdom에는 PointerEvent가 없어서 pointerId/pointerType을 직접 붙인다). */
function pointer(el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', x: number, y: number, opts: { id?: number; kind?: 'mouse' | 'touch'; buttons?: number } = {}) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : (opts.buttons ?? 1) });
  Object.defineProperty(ev, 'pointerId', { value: opts.id ?? 1 });
  Object.defineProperty(ev, 'pointerType', { value: opts.kind ?? 'mouse' });
  fireEvent(el, ev);
}
/** 마우스로 (x0,y0)에서 (x1,y1)까지 끌고 놓는다. */
const mouseDrag = (el: Element, x0: number, y0: number, x1: number, y1: number) => {
  pointer(el, 'pointerdown', x0, y0);
  pointer(el, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
  pointer(el, 'pointermove', x1, y1);
  pointer(el, 'pointerup', x1, y1);
};
const zoomIn = (times = 1) => {
  for (let i = 0; i < times; i++) fireEvent.click(button('확대'));
};

describe('지도: 마우스 휠', () => {
  it('휠을 올리면 커서 위치를 기준으로 확대된다 (커서 아래의 지도 지점이 그대로 머문다)', async () => {
    await openMap();
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    // 상자의 (75%, 50%) 지점 = (400, 150)
    const notPrevented = fireEvent.wheel(box(), { deltaY: -300, clientX: 400, clientY: 150 });
    expect(notPrevented).toBe(false); // 확대 중에는 페이지가 같이 스크롤되지 않게 막는다
    const [x, y, w, h] = viewBox();
    expect(w).toBeLessThan(360);
    expect(w / h).toBeCloseTo(2);
    expect(x + 0.75 * w).toBeCloseTo(0.75 * 360, 4);
    expect(y + 0.5 * h).toBeCloseTo(0.5 * 180, 4);
  });

  it('휠을 내리면 축소되고, 이미 세계 전체이면 막지 않아서 페이지가 스크롤된다', async () => {
    await openMap();
    // 세계 전체에서 더 축소할 수 없음 → 기본 동작(페이지 스크롤)을 막지 않는다
    expect(fireEvent.wheel(box(), { deltaY: 200, clientX: 300, clientY: 150 })).toBe(true);
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    // 확대한 뒤에는 휠 내리기가 축소이고, 막는다
    fireEvent.wheel(box(), { deltaY: -500, clientX: 300, clientY: 150 });
    const zoomedW = viewBox()[2];
    expect(zoomedW).toBeLessThan(360);
    expect(fireEvent.wheel(box(), { deltaY: 200, clientX: 300, clientY: 150 })).toBe(false);
    expect(viewBox()[2]).toBeGreaterThan(zoomedW);
  });

  it('최대로 확대해도 더 들어가지 않고, 그 상태에서도 휠 올리기가 페이지를 스크롤시키지 않는다', async () => {
    await openMap();
    for (let i = 0; i < 30; i++) fireEvent.wheel(box(), { deltaY: -400, clientX: 300, clientY: 150 });
    expect(viewBox()[2]).toBe(MIN_VIEW_W);
    expect(fireEvent.wheel(box(), { deltaY: -400, clientX: 300, clientY: 150 })).toBe(false);
    expect(viewBox()[2]).toBe(MIN_VIEW_W);
  });

  it('트랙패드 핀치(ctrl+휠)도 확대된다', async () => {
    await openMap();
    fireEvent.wheel(box(), { deltaY: -20, ctrlKey: true, clientX: 300, clientY: 150 });
    expect(viewBox()[2]).toBeLessThan(360);
  });

  it('휠로 확대하면 보이는 영역 안의 마커만 남는다', async () => {
    await openMap();
    expect(markers()).toHaveLength(PLAYABLE);
    const p = project(content.countries.find((c) => c.id === 'KR')!)!; // 한국의 지도 위치
    fireEvent.wheel(box(), { deltaY: -1500, clientX: 100 + (p.x / 360) * 400, clientY: 50 + (p.y / 180) * 200 });
    const labels = markers().map((m) => m.getAttribute('aria-label'));
    expect(labels.some((l) => l?.includes('대한민국'))).toBe(true);
    expect(labels.some((l) => l?.includes('브라질'))).toBe(false);
    expect(markers().length).toBeLessThan(PLAYABLE);
  });
});

describe('지도: 버튼과 키보드', () => {
  it('＋/－ 버튼으로 확대 축소하고, 끝에서는 비활성화된다', async () => {
    await openMap();
    expect((button('축소') as HTMLButtonElement).disabled).toBe(true); // 세계 전체
    zoomIn();
    expect(viewBox()[2]).toBeCloseTo(360 / 1.6, 6);
    expect((button('축소') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button('축소'));
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    zoomIn(20);
    expect(viewBox()[2]).toBe(MIN_VIEW_W);
    expect((button('확대') as HTMLButtonElement).disabled).toBe(true);
  });

  it('직접 옮기면 ⟲(처음 위치로)가 나타나고, 누르면 원래 보기로 돌아온다', async () => {
    await openMap();
    expect(queryButton('처음 위치로')).toBeNull();
    zoomIn(2);
    expect(button('처음 위치로')).toBeTruthy();
    fireEvent.click(button('처음 위치로'));
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    expect(queryButton('처음 위치로')).toBeNull();
  });

  it('키보드: + - 로 확대 축소, 화살표로 이동, 0으로 처음 위치', async () => {
    await openMap();
    box().focus();
    fireEvent.keyDown(box(), { key: '+' });
    const afterZoom = viewBox();
    expect(afterZoom[2]).toBeLessThan(360);
    fireEvent.keyDown(box(), { key: 'ArrowRight' });
    expect(viewBox()[0]).toBeGreaterThan(afterZoom[0]); // 오른쪽 키: 영역이 오른쪽으로
    fireEvent.keyDown(box(), { key: 'ArrowLeft' });
    expect(viewBox()[0]).toBeCloseTo(afterZoom[0], 6);
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(viewBox()[1]).toBeGreaterThan(afterZoom[1]);
    fireEvent.keyDown(box(), { key: '-' });
    fireEvent.keyDown(box(), { key: '+' });
    fireEvent.keyDown(box(), { key: '0' });
    expect(viewBox()).toEqual([0, 0, 360, 180]);
  });

  it('ctrl/⌘/alt가 눌린 키는 브라우저 단축키이므로 건드리지 않는다', async () => {
    await openMap();
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(fireEvent.keyDown(box(), { key: '+', ...mod })).toBe(true); // 막지 않음
    }
    expect(viewBox()).toEqual([0, 0, 360, 180]);
    expect(fireEvent.keyDown(box(), { key: 'a' })).toBe(true); // 관계없는 키도 막지 않음
  });
});

describe('지도: 마우스로 끌기', () => {
  it('끌면 지도가 따라오고(영역은 반대로), 놓으면 끝난다', async () => {
    await openMap();
    zoomIn(3);
    const before = viewBox();
    mouseDrag(box(), 300, 150, 260, 150); // 왼쪽으로 40px = 상자 폭의 10%
    const after = viewBox();
    expect(after[0] - before[0]).toBeCloseTo(0.1 * before[2], 4);
    expect(after[2]).toBe(before[2]); // 끌기는 크기를 바꾸지 않는다
    expect(box().classList.contains('grabbing')).toBe(false);
    // 위/아래도 된다
    mouseDrag(box(), 300, 150, 300, 110);
    expect(viewBox()[1]).toBeGreaterThan(after[1]);
  });

  it('끌다가 놓은 자리의 나라는 눌리지 않는다. 짧게 움직인 건 그냥 클릭이다', async () => {
    await openMap();
    zoomIn(2);
    const marker = markers().find((m) => m.getAttribute('aria-label')?.includes('대한민국')) ?? markers()[0];
    // 마커 위에서 시작해 멀리 끌고 놓음 → 브라우저는 곧바로 click을 보낸다
    pointer(marker, 'pointerdown', 300, 150);
    pointer(marker, 'pointermove', 340, 150);
    pointer(marker, 'pointerup', 340, 150);
    fireEvent.click(marker);
    expect(document.querySelector('.detail')).toBeNull();
    // 그 다음의 진짜 클릭은 정상 동작
    pointer(marker, 'pointerdown', 300, 150);
    pointer(marker, 'pointermove', 301, 151); // 4px 미만
    pointer(marker, 'pointerup', 301, 151);
    fireEvent.click(marker);
    expect(document.querySelector('.detail')).toBeTruthy();
  });

  it('확대/축소 버튼 위에서 시작한 누르기는 끌기로 치지 않는다', async () => {
    await openMap();
    zoomIn();
    const before = viewBox();
    const ctl = button('확대');
    pointer(ctl, 'pointerdown', 480, 70);
    pointer(ctl, 'pointermove', 300, 70);
    pointer(ctl, 'pointerup', 300, 70);
    expect(viewBox()).toEqual(before);
  });

  it('왼쪽 버튼이 아니면 끌지 않는다 / 버튼을 뗀 채로 움직이면 따라가지 않는다', async () => {
    await openMap();
    zoomIn(2);
    const before = viewBox();
    pointer(box(), 'pointermove', 100, 100, { buttons: 0 });
    pointer(box(), 'pointermove', 50, 100, { buttons: 0 });
    expect(viewBox()).toEqual(before);
  });
});

describe('지도: 터치 (두 손가락)', () => {
  it('두 손가락을 벌리면 확대되고, 가운데 지점이 그대로 머문다', async () => {
    await openMap();
    // 두 손가락 (250,150),(350,150) → 가운데 (300,150) = 상자의 (50%, 50%)
    pointer(box(), 'pointerdown', 250, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerdown', 350, 150, { id: 2, kind: 'touch' });
    pointer(box(), 'pointermove', 200, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointermove', 400, 150, { id: 2, kind: 'touch' }); // 간격 100 → 200 (2배)
    const [x, y, w, h] = viewBox();
    expect(w).toBeCloseTo(180, 4);
    expect(x + w / 2).toBeCloseTo(180, 4);
    expect(y + h / 2).toBeCloseTo(90, 4);
    pointer(box(), 'pointerup', 200, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerup', 400, 150, { id: 2, kind: 'touch' });
  });

  it('두 손가락을 오므리면 축소된다', async () => {
    await openMap();
    zoomIn(3);
    const w0 = viewBox()[2];
    pointer(box(), 'pointerdown', 200, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerdown', 400, 150, { id: 2, kind: 'touch' });
    pointer(box(), 'pointermove', 250, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointermove', 350, 150, { id: 2, kind: 'touch' }); // 200 → 100
    expect(viewBox()[2]).toBeCloseTo(w0 * 2, 3);
  });

  it('두 손가락을 함께 움직이면 지도가 이동한다', async () => {
    await openMap();
    zoomIn(3);
    const before = viewBox();
    pointer(box(), 'pointerdown', 250, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerdown', 350, 150, { id: 2, kind: 'touch' });
    pointer(box(), 'pointermove', 290, 150, { id: 1, kind: 'touch' }); // 둘 다 오른쪽으로 40px (간격은 그대로)
    pointer(box(), 'pointermove', 390, 150, { id: 2, kind: 'touch' });
    const after = viewBox();
    expect(after[2]).toBeCloseTo(before[2], 6);
    expect(after[0]).toBeLessThan(before[0]); // 지도가 오른쪽으로 따라오므로 영역은 왼쪽으로
    expect(before[0] - after[0]).toBeCloseTo(0.1 * before[2], 3);
  });

  it('한 손가락 움직임은 지도를 건드리지 않는다 (페이지 스크롤에 맡김)', async () => {
    await openMap();
    zoomIn(3);
    const before = viewBox();
    pointer(box(), 'pointerdown', 300, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointermove', 300, 60, { id: 1, kind: 'touch' });
    pointer(box(), 'pointermove', 200, 60, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerup', 200, 60, { id: 1, kind: 'touch' });
    expect(viewBox()).toEqual(before);
  });

  it('핀치가 끝나면 손가락 하나를 뗀 뒤의 움직임은 무시되고, 다시 두 손가락으로 시작할 수 있다', async () => {
    await openMap();
    pointer(box(), 'pointerdown', 250, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerdown', 350, 150, { id: 2, kind: 'touch' });
    pointer(box(), 'pointermove', 200, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerup', 200, 150, { id: 1, kind: 'touch' }); // 하나 뗌
    const afterOne = viewBox();
    pointer(box(), 'pointermove', 100, 100, { id: 2, kind: 'touch' }); // 남은 한 손가락 → 무시
    expect(viewBox()).toEqual(afterOne);
    pointer(box(), 'pointerup', 100, 100, { id: 2, kind: 'touch' });
    // 새로 시작
    pointer(box(), 'pointerdown', 250, 150, { id: 3, kind: 'touch' });
    pointer(box(), 'pointerdown', 350, 150, { id: 4, kind: 'touch' });
    pointer(box(), 'pointermove', 200, 150, { id: 3, kind: 'touch' });
    expect(viewBox()[2]).toBeLessThan(afterOne[2]);
  });

  it('손가락이 취소(pointercancel, 예: 페이지 스크롤이 시작됨)되어도 상태가 꼬이지 않는다', async () => {
    await openMap();
    pointer(box(), 'pointerdown', 250, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointercancel', 250, 150, { id: 1, kind: 'touch' });
    pointer(box(), 'pointerdown', 250, 150, { id: 5, kind: 'touch' });
    pointer(box(), 'pointerdown', 350, 150, { id: 6, kind: 'touch' });
    pointer(box(), 'pointermove', 200, 150, { id: 5, kind: 'touch' });
    expect(viewBox()[2]).toBeLessThan(360); // 정상적으로 핀치가 시작됨
  });
});

describe('지도: 직접 옮긴 뒤 나라/대륙 선택', () => {
  it('직접 옮겨 둔 상태에서도 나라를 누르면 그 나라로 확대된다 (같은 나라를 다시 눌러도)', async () => {
    await openMap();
    const area = () => document.querySelector('[data-country="KR"]')!;
    fireEvent.click(area());
    const focus = focusView(COUNTRY_SHAPES.KR.box);
    expect(viewBox()).toEqual([focus.x, focus.y, focus.w, focus.h]);
    // 손으로 축소해서 멀리 보다가
    for (let i = 0; i < 6; i++) fireEvent.click(button('축소'));
    expect(viewBox()[2]).toBeGreaterThan(focus.w);
    expect(button('처음 위치로')).toBeTruthy();
    // 같은 나라를 다시 누르면 다시 확대
    fireEvent.click(area());
    expect(viewBox()).toEqual([focus.x, focus.y, focus.w, focus.h]);
    expect(queryButton('처음 위치로')).toBeNull();
  });

  it('손으로 옮긴 뒤 ⟲를 누르면 선택한 나라 보기로 돌아가고(세계가 아니라), 닫으면 세계로 돌아간다', async () => {
    await openMap();
    fireEvent.click(document.querySelector('[data-country="JP"]')!);
    const focus = focusView(COUNTRY_SHAPES.JP.box);
    zoomIn(2);
    fireEvent.click(button('처음 위치로'));
    expect(viewBox()).toEqual([focus.x, focus.y, focus.w, focus.h]);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(viewBox()).toEqual([0, 0, 360, 180]);
  });

  it('나라가 선택된 채로 손으로 움직이면 보이는 영역의 다른 나라 마커도 보이고, 선택은 그대로 유지된다', async () => {
    await openMap();
    fireEvent.click(document.querySelector('[data-country="KR"]')!);
    expect(markers()).toHaveLength(1); // 확대 중에는 그 나라만
    for (let i = 0; i < 3; i++) fireEvent.click(button('축소'));
    expect(markers().length).toBeGreaterThan(1); // 옮기는 중에는 영역 안의 마커가 모두
    expect(document.querySelector('.detail')).toBeTruthy();
    expect(document.querySelector('[data-country="KR"]')!.classList.contains('selected')).toBe(true);
  });

  it('대륙 버튼은 직접 옮긴 상태를 풀고 그 대륙으로 간다', async () => {
    await openMap();
    zoomIn(4);
    fireEvent.click(screen.getByRole('button', { name: '유럽' }));
    expect(queryButton('처음 위치로')).toBeNull();
    expect(viewBox()[2]).toBeLessThan(360);
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    expect(viewBox()).toEqual([0, 0, 360, 180]);
  });
});

describe('지도: 접근성과 정리', () => {
  it('지도 상자는 키보드로 들어갈 수 있고 사용법을 알려준다', async () => {
    await openMap();
    expect(box().getAttribute('tabindex')).toBe('0');
    expect(box().getAttribute('role')).toBe('group');
    expect(box().getAttribute('aria-label')).toMatch(/화살표.*더하기.*빼기/);
    expect(screen.getByRole('group', { name: '지도 확대와 이동' })).toBeTruthy();
    expect(screen.getByText(/휠로 확대하고 끌어서 움직여요/)).toBeTruthy();
  });

  it('지도 탭을 떠나도 휠 리스너가 남아 오류를 내지 않는다', async () => {
    await openMap();
    const el = box();
    fireEvent.click(screen.getByRole('button', { name: /홈/ }));
    expect(() => fireEvent.wheel(el, { deltaY: -100, clientX: 300, clientY: 150 })).not.toThrow();
  });
});
