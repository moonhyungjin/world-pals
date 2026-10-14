// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { LabLayout } from './features/lab/LabLayout';
import { STORAGE_KEYS } from './lib/storageKeys';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const buttonByText = (text: string | RegExp) => screen.getByRole('button', { name: text });
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
const heroLabel = () => document.querySelector('.home .character, .customize .character')?.getAttribute('aria-label');
const returning = (extra: object = {}) =>
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ totalAnswered: 5, completedDates: ['2026-10-12'], ...extra }));

describe('캐릭터 고르기 (실제 클릭)', () => {
  it('처음 시작하면 홈에서 캐릭터를 고를 수 있고, 고른 캐릭터가 바로 보인다', () => {
    render(<App />);
    expect(screen.getByText('함께 탐험할 친구를 골라요!')).toBeTruthy();
    expect(document.querySelectorAll('.char-option')).toHaveLength(4);
    expect(heroLabel()).toBe('캐릭터 폭시'); // 아무것도 안 골라도 기본은 폭시
    fireEvent.click(buttonByText(/토토/));
    expect(saved().characterId).toBe('character.bunny');
    expect(heroLabel()).toBe('캐릭터 토토');
    expect(buttonByText(/토토/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/깡충깡충/)).toBeTruthy();
    // 마음이 바뀌면 다른 캐릭터로 바꿀 수 있다
    fireEvent.click(buttonByText(/펭펭/));
    expect(saved().characterId).toBe('character.penguin');
    expect(heroLabel()).toBe('캐릭터 펭펭');
  });

  it('한 번 탐험한 뒤에는 홈의 고르기 안내가 사라지고, 꾸미기에서 언제든 바꿀 수 있다', () => {
    returning({ characterId: 'character.bunny' });
    const first = render(<App />);
    expect(screen.queryByText('함께 탐험할 친구를 골라요!')).toBeNull();
    expect(heroLabel()).toBe('캐릭터 토토');

    fireEvent.click(buttonByText(/꾸미기/));
    expect(screen.getByText('🧸 내 캐릭터')).toBeTruthy();
    fireEvent.click(buttonByText(/냥냥/));
    expect(saved().characterId).toBe('character.cat');
    expect(screen.getByText(/냥냥와 함께 떠나요/)).toBeTruthy();
    expect(heroLabel()).toBe('캐릭터 냥냥');

    // 새로고침해도 유지
    first.unmount();
    render(<App />);
    expect(heroLabel()).toBe('캐릭터 냥냥');
  });

  it('캐릭터를 바꿔도 장식과 함께 다니는 친구는 그대로다', () => {
    returning({
      discoveredCountryIds: ['KR'],
      stampTiers: { KR: 'gold' },
      unlockedRewardIds: ['cosmetic.explorer-hat'],
      equippedCosmeticIds: ['cosmetic.explorer-hat'],
      companionId: 'companion.kr',
    });
    render(<App />);
    fireEvent.click(buttonByText(/꾸미기/));
    fireEvent.click(buttonByText(/펭펭/));
    expect(heroLabel()).toBe('캐릭터 펭펭, 함께 다니는 호랑이');
    // 모자는 그림(SVG)으로 캐릭터 위에 얹힌다
    expect(document.querySelector('.customize .character .cosmetic-art.slot-head')?.getAttribute('src')).toMatch(/explorer-hat.*\.svg/);
    expect(saved().equippedCosmeticIds).toEqual(['cosmetic.explorer-hat']);
    expect(saved().companionId).toBe('companion.kr');
  });

  it('저장된 캐릭터가 사라졌거나 이상한 값이면 폭시로 시작하고 멈추지 않는다', () => {
    for (const bad of ['character.nope', 123, '']) {
      returning({ characterId: bad });
      const { unmount } = render(<App />);
      expect(heroLabel()).toBe('캐릭터 폭시');
      unmount();
    }
  });

  it('캐릭터 그림은 이미지로 그려지고 접근성 이름은 캐릭터 이름이다', () => {
    returning({ characterId: 'character.penguin' });
    render(<App />);
    const img = document.querySelector<HTMLImageElement>('.home .character-face')!;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('alt')).toBe(''); // 장식 이미지 (이름은 바깥 role="img" 라벨이 맡음)
    expect(img.getAttribute('src')).toMatch(/penguin.*\.svg/);
  });

  it('도전장 링크로 처음 들어와도 캐릭터 그림과 함께 도전장 화면이 열린다', async () => {
    window.location.hash = '#/c/KRc.JPf.FRc';
    await new Promise((r) => setTimeout(r, 20));
    render(<App />);
    expect(screen.getByText('💌 도전장이 왔어요!')).toBeTruthy();
    expect(document.querySelector('.challenge .character-face')).toBeTruthy();
  });

  it('Lab: 캐릭터 탭에서 목록을 보고 편집하면 검증 오류가 보인다', () => {
    render(<LabLayout onExit={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /보상 \(/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^캐릭터 \(4\)/ }));
    const name = screen.getByLabelText('이름') as HTMLInputElement;
    expect(name.value).toBe('폭시');
    fireEvent.change(name, { target: { value: '' } });
    expect(screen.getByText(/이름을 입력해 주세요/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('그림 키', { exact: false }), { target: { value: 'bunny' } });
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.labDraft)!);
    expect(draft.characters[0].assetKey).toBe('bunny');
    expect(draft.characters).toHaveLength(4);
  });
});
