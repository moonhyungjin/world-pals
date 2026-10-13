import { describe, expect, it } from 'vitest';
import { content } from './content';
import { eligibleQuestions } from '../features/quiz/quizEngine';
import { validateContent, hasErrors } from '../features/lab/validators';
import { CHARACTER_ASSET_KEYS } from '../features/characters/characterAssets';

// 국기 파일 목록 (앱이 쓰는 방식과 같게 Vite의 파일 목록 기능으로 가져온다)
const FLAG_FILES = Object.keys(import.meta.glob('../../node_modules/flag-icons/flags/4x3/*.svg', { query: '?url' }));
const hasFlagFile = (id: string) => FLAG_FILES.some((f) => f.endsWith(`/${id.toLowerCase()}.svg`));

const verified = content.countries.filter((c) => c.status === 'verified');
const CONTINENTS = ['아시아', '유럽', '아프리카', '북아메리카', '남아메리카', '오세아니아'];
// 같은 문제의 보기로 묶으면 헷갈리는 국기들 (콘텐츠를 만들 때의 규칙)
const CONFUSABLE = [['AU', 'NZ', 'FJ'], ['IT', 'MX', 'MG'], ['FR', 'RU'], ['US', 'GB', 'CL', 'CU'], ['ID', 'TH', 'CR'], ['NO', 'IS', 'FI'], ['CO', 'EC'], ['PH', 'CU']];

describe('콘텐츠 품질 (게임에 나오는 나라 전체)', () => {
  it('게임에 나오는 나라가 40개 이상이고 모든 대륙이 있다', () => {
    expect(verified.length).toBeGreaterThanOrEqual(40);
    for (const continent of CONTINENTS) expect(verified.some((c) => c.continent === continent), continent).toBe(true);
    expect(verified.every((c) => CONTINENTS.includes(c.continent))).toBe(true);
  });
  it('나라마다 필수 정보가 있고 ID는 국기 파일이 있는 2글자 코드다', () => {
    for (const c of verified) {
      expect(c.id, c.id).toMatch(/^[A-Z]{2}$/);
      expect(hasFlagFile(c.id), `${c.id} 국기`).toBe(true);
      expect(c.nameKo.trim(), c.id).not.toBe('');
      expect(c.capitalKo.trim(), c.id).not.toBe('');
      expect(c.factKo.trim().length, c.id).toBeGreaterThan(5);
      expect(c.latitude, c.id).toBeGreaterThanOrEqual(-90);
      expect(c.latitude, c.id).toBeLessThanOrEqual(90);
      expect(c.longitude, c.id).toBeGreaterThanOrEqual(-180);
      expect(c.longitude, c.id).toBeLessThanOrEqual(180);
      expect(c.sourceNote, `${c.id} 출처 메모`).toBeTruthy();
    }
  });
  it('수도 이름과 국가 이름이 서로 겹치지 않는다 (보기 중복 방지)', () => {
    const caps = verified.map((c) => c.capitalKo);
    expect(new Set(caps).size).toBe(caps.length);
    const names = verified.map((c) => c.nameKo);
    expect(new Set(names).size).toBe(names.length);
  });
  it('나라마다 수도 문제와 국기 문제가 하나씩 있고 모두 출제 가능하다', () => {
    const eligible = eligibleQuestions(content);
    for (const c of verified) {
      for (const type of ['capital', 'flag'] as const) {
        const mine = eligible.filter((q) => q.countryId === c.id && q.type === type);
        expect(mine, `${c.nameKo} ${type}`).toHaveLength(1);
      }
    }
    expect(eligible).toHaveLength(verified.length * 2);
  });
  it('국기 문제의 보기에 비슷한 국기가 함께 있지 않다', () => {
    for (const q of content.questions.filter((x) => x.type === 'flag')) {
      const ids = [q.countryId, ...q.distractorCountryIds];
      for (const g of CONFUSABLE) expect(ids.filter((id) => g.includes(id)).length, q.id).toBeLessThan(2);
    }
  });
  it('모든 문제의 오답 보기는 게임에 나오는 나라다', () => {
    const ok = new Set(verified.map((c) => c.id));
    for (const q of content.questions.filter((x) => x.status === 'verified')) {
      for (const id of [q.countryId, ...q.distractorCountryIds]) expect(ok.has(id), `${q.id} → ${id}`).toBe(true);
    }
  });
  it('나라마다 탐험 친구가 한 마리씩 있고, 이모지는 겹치지 않는다', () => {
    for (const c of verified) {
      expect(content.companions.filter((x) => x.countryId === c.id && x.status === 'verified'), c.nameKo).toHaveLength(1);
    }
    const emojis = content.companions.map((x) => x.emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
    // 주인공 캐릭터(여우/토끼/펭귄/고양이)와 같은 동물은 친구로 쓰지 않는다
    expect(emojis.filter((e) => ['🦊', '🐰', '🐇', '🐧', '🐱'].includes(e))).toEqual([]);
  });
  it('데이터 전체가 Lab 검증을 오류 없이 통과한다', () => {
    expect(hasErrors(validateContent(structuredClone(content)))).toBe(false);
    expect(CHARACTER_ASSET_KEYS.length).toBeGreaterThan(0);
  });
  it('수도가 논란이 되는 국가는 출제 제외(review) 상태로 남아 있다', () => {
    for (const id of ['NL', 'ZA', 'ID']) {
      expect(content.countries.find((c) => c.id === id)?.status, id).toBe('review');
    }
  });
});
