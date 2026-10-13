import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { defaultProgress } from '../../lib/saveData';
import type { QuizAnswer } from '../../types/question';
import { applySession } from '../quiz/quizEngine';
import {
  awardBadges,
  completeSession,
  equipCosmetic,
  unequipCosmetic,
  unlockCosmetic,
} from './rewardEngine';

const ok = (ids: string[]): QuizAnswer[] =>
  ids.map((id) => ({ questionId: `q.capital.${id}`, countryId: id, correct: true }));
const cos = (id: string) => content.cosmetics.find((c) => c.id === id)!;
const D = '2026-10-13';

describe('콘텐츠 데이터 (보상)', () => {
  it('배지/장식 ID가 고유하다', () => {
    expect(new Set(content.badges.map((b) => b.id)).size).toBe(content.badges.length);
    expect(new Set(content.cosmetics.map((c) => c.id)).size).toBe(content.cosmetics.length);
  });
  it('장식 비용은 음수가 아니다', () => {
    expect(content.cosmetics.every((c) => c.cost >= 0)).toBe(true);
  });
});

describe('배지', () => {
  it('첫 탐험이면 첫 탐험/첫 나라 배지를 받는다', () => {
    const r = completeSession(defaultProgress(), ok(['KR', 'JP']), D, content);
    expect(r.newBadges.map((b) => b.id).sort()).toEqual(['badge.first-country', 'badge.first-session']);
  });
  it('이미 가진 배지는 다시 지급되지 않는다', () => {
    const first = completeSession(defaultProgress(), ok(['KR']), D, content);
    const again = awardBadges(first.progress, content);
    expect(again.newBadges).toEqual([]);
    expect(new Set(first.progress.collectedBadgeIds).size).toBe(first.progress.collectedBadgeIds.length);
  });
  it('아시아 5개국 배지', () => {
    const r = completeSession(defaultProgress(), ok(['KR', 'JP', 'CN', 'IN', 'TH']), D, content);
    expect(r.newBadges.map((b) => b.id)).toContain('badge.asia-5');
  });
  it('오답 복습을 맞히면 복습 배지를 받는다', () => {
    const p = { ...defaultProgress(), wrongQuestionIds: ['q.capital.KR'] };
    const r = completeSession(p, ok(['KR']), D, content, { practice: true });
    expect(r.newBadges.map((b) => b.id)).toContain('badge.review-1');
    expect(r.progress.reviewCorrectCount).toBe(1);
  });
  it('복습 세션(practice)은 별/일일 보상 없이 기본 도장만 준다', () => {
    const p = { ...defaultProgress(), wrongQuestionIds: ['q.capital.KR'] };
    const r = applySession(p, ok(['KR']), D, { practice: true });
    expect(r.summary.rewarded).toBe(false);
    expect(r.progress.totalStars).toBe(0);
    expect(r.progress.stampTiers).toEqual({ KR: 'basic' });
    expect(r.progress.rewardEventIds).not.toContain(`daily:${D}`);
  });
});

describe('장식 해금/장착', () => {
  const rich = { ...defaultProgress(), totalStars: 20 };
  it('별을 쓰고 해금한다', () => {
    const r = unlockCosmetic(rich, cos('cosmetic.explorer-hat'));
    expect(r.ok && r.progress.totalStars).toBe(15);
    expect(r.ok && r.progress.unlockedRewardIds).toEqual(['cosmetic.explorer-hat']);
  });
  it('별이 모자라면 해금되지 않는다', () => {
    const r = unlockCosmetic({ ...rich, totalStars: 4 }, cos('cosmetic.explorer-hat'));
    expect(r).toEqual({ ok: false, reason: 'not-enough-stars' });
  });
  it('이미 해금한 장식은 별을 다시 쓰지 않는다', () => {
    const first = unlockCosmetic(rich, cos('cosmetic.explorer-hat'));
    if (!first.ok) throw new Error('unlock failed');
    expect(unlockCosmetic(first.progress, cos('cosmetic.explorer-hat'))).toEqual({ ok: false, reason: 'owned' });
  });
  it('해금하지 않은 장식은 장착할 수 없다', () => {
    const r = equipCosmetic(rich, cos('cosmetic.crown'), content.cosmetics);
    expect(r.equippedCosmeticIds).toEqual([]);
  });
  it('같은 슬롯은 교체되고 다른 슬롯은 유지된다', () => {
    let p = { ...rich, totalStars: 100, unlockedRewardIds: content.cosmetics.map((c) => c.id) };
    p = equipCosmetic(p, cos('cosmetic.explorer-hat'), content.cosmetics);
    p = equipCosmetic(p, cos('cosmetic.backpack'), content.cosmetics);
    p = equipCosmetic(p, cos('cosmetic.crown'), content.cosmetics);
    expect([...p.equippedCosmeticIds].sort()).toEqual(['cosmetic.backpack', 'cosmetic.crown']);
    p = unequipCosmetic(p, 'cosmetic.crown');
    expect(p.equippedCosmeticIds).toEqual(['cosmetic.backpack']);
  });
});
