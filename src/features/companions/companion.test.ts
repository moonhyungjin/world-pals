import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { defaultProgress } from '../../lib/saveData';
import {
  activeCompanion,
  companionOfCountry,
  newlyMetCompanions,
  setActiveCompanion,
  unlockedCompanions,
} from './companionEngine';
import { applySession } from '../quiz/quizEngine';

const met = (ids: string[]) => ({ ...defaultProgress(), discoveredCountryIds: ids });
const D = '2026-10-13';

describe('탐험 친구', () => {
  it('도장을 받은 나라의 친구만 만난다', () => {
    expect(unlockedCompanions(content, defaultProgress())).toEqual([]);
    expect(unlockedCompanions(content, met(['KR', 'AU'])).map((c) => c.id).sort()).toEqual(['companion.au', 'companion.kr']);
  });
  it('출제 제외(review) 나라나 초안 친구는 만날 수 없다', () => {
    const c = structuredClone(content);
    c.companions.push({ id: 'companion.nl', countryId: 'NL', nameKo: '소', emoji: '🐄', descriptionKo: 'x', status: 'verified' });
    expect(unlockedCompanions(c, met(['NL'])).map((x) => x.id)).not.toContain('companion.nl');
    c.companions.find((x) => x.id === 'companion.kr')!.status = 'draft';
    expect(unlockedCompanions(c, met(['KR']))).toEqual([]);
  });
  it('만난 친구만 함께 다닐 수 있고, 같은 친구를 다시 고르거나 못 만난 친구를 고르면 기록이 바뀌지 않는다', () => {
    const p = met(['KR', 'JP']);
    const withTiger = setActiveCompanion(p, content, 'companion.kr');
    expect(withTiger.companionId).toBe('companion.kr');
    expect(setActiveCompanion(withTiger, content, 'companion.kr')).toBe(withTiger);
    expect(setActiveCompanion(withTiger, content, 'companion.au')).toBe(withTiger); // 못 만남
    expect(setActiveCompanion(withTiger, content, 'companion.nope')).toBe(withTiger); // 없는 ID
    expect(setActiveCompanion(withTiger, content, null).companionId).toBeNull();
  });
  it('함께 다니던 친구가 콘텐츠에서 사라지면 혼자가 된다 (앱이 멈추지 않음)', () => {
    const p = { ...met(['KR']), companionId: 'companion.kr' };
    expect(activeCompanion(content, p)?.nameKo).toBe('호랑이');
    const c = structuredClone(content);
    c.companions = c.companions.filter((x) => x.id !== 'companion.kr');
    expect(activeCompanion(c, p)).toBeNull();
    expect(activeCompanion(content, { ...p, companionId: 'companion.au' })).toBeNull(); // 못 만난 친구를 가리키는 값
  });
  it('새 나라 도장을 받을 때만 새 친구를 만난다 (업그레이드는 아님)', () => {
    const answers = [{ questionId: 'q.capital.KR', countryId: 'KR', correct: true }];
    const first = applySession(defaultProgress(), answers, '2026-10-13', { practice: true });
    expect(newlyMetCompanions(content, first.summary.stamps).map((c) => c.id)).toEqual(['companion.kr']);
    const upgrade = applySession(first.progress, answers, D);
    expect(upgrade.summary.stamps[0].kind).toBe('upgrade');
    expect(newlyMetCompanions(content, upgrade.summary.stamps)).toEqual([]);
  });
  it('나라에 연결된 친구를 찾는다', () => {
    expect(companionOfCountry(content, 'AU')?.emoji).toBe('🦘');
    expect(companionOfCountry(content, 'ZZ')).toBeUndefined();
  });
  it('저장 데이터에서 잘못된 친구 값은 null로 복구된다', async () => {
    const { sanitizeProgress } = await import('../../lib/saveData');
    expect(sanitizeProgress({ companionId: 5 }).companionId).toBeNull();
    expect(sanitizeProgress({ companionId: '' }).companionId).toBeNull();
    expect(sanitizeProgress({ companionId: 'companion.kr' }).companionId).toBe('companion.kr');
  });
});
