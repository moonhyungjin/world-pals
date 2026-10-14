// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { makeResultCode } from './features/challenge/friendResult';
import { STORAGE_KEYS } from './lib/storageKeys';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
const returning = (extra: object = {}) =>
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ totalAnswered: 5, completedDates: ['2026-10-12'], ...extra }));
const KEY = 'FRc.JPf.KRc';

describe('친구 결과 확인 (홈)', () => {
  it('도전장을 만든 적이 없으면 보이지 않는다', () => {
    returning();
    render(<App />);
    expect(screen.queryByText(/친구가 푼 결과 확인하기/)).toBeNull();
  });

  it('만든 도전장의 결과를 붙여 넣으면 별을 받고, 같은 결과는 다시 받지 못한다', () => {
    returning({ rewardEventIds: [`challenge-made:${KEY}`] });
    render(<App />);
    const text = `World Pals 도전장 결과 ⭕⭕⭕ (3/3)\n확인코드: ${makeResultCode({ key: KEY, score: 3, total: 3, solverId: 'friend01a' })}`;
    fireEvent.change(screen.getByLabelText('친구가 보낸 결과'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: '별 받기' }));
    expect(screen.getByRole('status').textContent).toMatch(/별 2개를 받았어요/);
    expect(saved().totalStars).toBe(2);
    expect(saved().friendBonusToday).toBe(2);

    fireEvent.change(screen.getByLabelText('친구가 보낸 결과'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: '별 받기' }));
    expect(screen.getByRole('status').textContent).toMatch(/이미 받은 친구/);
    expect(saved().totalStars).toBe(2);
  });

  it('엉뚱한 글을 붙여 넣어도 멈추지 않고 안내만 나온다', () => {
    returning({ rewardEventIds: [`challenge-made:${KEY}`] });
    render(<App />);
    fireEvent.change(screen.getByLabelText('친구가 보낸 결과'), { target: { value: '아무 글' } });
    fireEvent.click(screen.getByRole('button', { name: '별 받기' }));
    expect(screen.getByRole('status').textContent).toMatch(/확인코드를 찾지 못했어요/);
    expect(saved().totalStars ?? 0).toBe(0);
  });

  it('도전장을 풀면 결과 복사 글에 확인코드가 들어가고 기기 번호가 저장된다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    window.location.hash = '#/c/KRc.JPf.FRc';
    await new Promise((r) => setTimeout(r, 20));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /시작|도전/ }));
    for (let i = 0; i < 3; i++) {
      const choices = document.querySelectorAll<HTMLButtonElement>('.choices button, .choice');
      fireEvent.click(choices[0]);
      fireEvent.click(screen.getByRole('button', { name: /다음|결과/ }));
    }
    fireEvent.click(await screen.findByRole('button', { name: /결과 친구에게 보내기/ }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalled();
    expect(writeText.mock.calls[0][0]).toMatch(/확인코드: WP1-FRc\.JPf\.KRc-\d-3-[a-z0-9]{8}-[a-z0-9]{6}/);
    expect(saved().solverId).toMatch(/^[a-z0-9]{8}$/);
  });
});
