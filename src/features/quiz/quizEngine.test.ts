import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { defaultProgress, sanitizeProgress } from '../../lib/saveData';
import { seededRng } from '../../lib/random';
import type { QuizAnswer } from '../../types/question';
import { applySession, buildQuizItem, buildSession, eligibleQuestions } from './quizEngine';

const countryById = new Map(content.countries.map((c) => [c.id, c]));

describe('콘텐츠 데이터', () => {
  it('ID가 고유하다', () => {
    expect(new Set(content.countries.map((c) => c.id)).size).toBe(content.countries.length);
    expect(new Set(content.questions.map((q) => q.id)).size).toBe(content.questions.length);
  });
  it('모든 문제가 존재하는 국가 ID만 참조한다', () => {
    for (const q of content.questions) {
      for (const id of [q.countryId, ...q.distractorCountryIds]) expect(countryById.has(id)).toBe(true);
    }
  });
  it('verified가 아닌 국가/문제는 출제 대상이 아니다', () => {
    const ids = new Set(eligibleQuestions(content).map((q) => q.countryId));
    expect(ids.has('NL')).toBe(false);
    expect(ids.has('ZA')).toBe(false);
    expect(ids.has('KR')).toBe(true);
  });
});

describe('buildSession', () => {
  it('5문제를 만들고 보기는 4개, 중복 없고, 정답이 정확히 한 번 있다', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const session = buildSession(content, defaultProgress(), seededRng(seed));
      expect(session).toHaveLength(5);
      expect(new Set(session.map((s) => s.questionId)).size).toBe(5);
      for (const item of session) {
        expect(item.choices).toHaveLength(4);
        expect(new Set(item.choices.map((c) => c.label)).size).toBe(4);
        expect(item.choices.filter((c) => c.countryId === item.countryId)).toHaveLength(1);
      }
    }
  });
  it('오답 문제를 복습으로 다시 섞는다', () => {
    const p = { ...defaultProgress(), wrongQuestionIds: ['q.capital.KR'] };
    const session = buildSession(content, p, seededRng(3));
    expect(session.some((s) => s.questionId === 'q.capital.KR')).toBe(true);
  });
});

const allCorrect = (ids: string[]): QuizAnswer[] =>
  ids.map((id) => ({ questionId: `q.capital.${id}`, countryId: id, correct: true }));

describe('국기 고르기 문제', () => {
  const flagQs = content.questions.filter((q) => q.type === 'flag');
  const groups = [['AU', 'NZ'], ['IT', 'MX'], ['FR', 'RU'], ['US', 'GB'], ['ID', 'TH']];
  it('모든 나라에 국기 문제가 있고 보기가 정확히 4개 국가다', () => {
    expect(flagQs).toHaveLength(content.countries.length);
    for (const q of flagQs) {
      expect(new Set([q.countryId, ...q.distractorCountryIds]).size).toBe(4);
    }
  });
  it('헷갈리기 쉬운 국기는 같은 문제에 함께 나오지 않는다', () => {
    for (const q of flagQs) {
      const ids = [q.countryId, ...q.distractorCountryIds];
      for (const g of groups) expect(ids.filter((id) => g.includes(id)).length).toBeLessThan(2);
    }
  });
  it('국기 문제도 4지선다로 만들어지고 정답이 한 번 있다', () => {
    const q = flagQs.find((x) => x.countryId === 'KR')!;
    const item = buildQuizItem(q, content, seededRng(1));
    expect(item.type).toBe('flag');
    expect(item.choices).toHaveLength(4);
    expect(item.choices.filter((c) => c.countryId === 'KR')).toHaveLength(1);
    expect(item.choices.find((c) => c.countryId === 'KR')!.label).toBe('대한민국');
  });
  it('세션에 두 유형이 모두 나올 수 있고, 같은 나라는 한 세션에 한 번만 나온다', () => {
    const types = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = buildSession(content, defaultProgress(), seededRng(seed));
      expect(new Set(s.map((i) => i.countryId)).size).toBe(s.length);
      s.forEach((i) => types.add(i.type));
    }
    expect(types).toEqual(new Set(['capital', 'flag']));
  });
  it('verified가 아닌 나라의 국기 문제는 출제되지 않는다', () => {
    const ids = eligibleQuestions(content).filter((q) => q.type === 'flag').map((q) => q.countryId);
    expect(ids).not.toContain('NL');
    expect(ids).toContain('KR');
  });
});

describe('applySession 보상', () => {
  const D1 = '2026-10-13';
  it('별과 황금 도장을 지급하고 오답을 기록한다', () => {
    const answers = [
      ...allCorrect(['KR', 'JP', 'FR', 'IT']),
      { questionId: 'q.capital.US', countryId: 'US', correct: false },
    ];
    const { progress, summary } = applySession(defaultProgress(), answers, D1);
    expect(summary.starsEarned).toBe(4 + 3);
    expect(progress.totalStars).toBe(7);
    expect([...progress.discoveredCountryIds].sort()).toEqual(['FR', 'IT', 'JP', 'KR']);
    expect(Object.values(progress.stampTiers).every((t) => t === 'gold')).toBe(true);
    expect(progress.wrongQuestionIds).toEqual(['q.capital.US']);
    expect(progress.currentStreak).toBe(1);
  });
  it('연습(같은 날 재플레이)에서는 별 없이 기본 도장만 준다', () => {
    const first = applySession(defaultProgress(), allCorrect(['KR']), D1);
    const practice = applySession(first.progress, allCorrect(['KR', 'DE']), D1);
    expect(practice.summary.rewarded).toBe(false);
    expect(practice.summary.starsEarned).toBe(0);
    expect(practice.progress.totalStars).toBe(first.progress.totalStars);
    expect(practice.summary.stamps).toEqual([{ countryId: 'DE', tier: 'basic', kind: 'new' }]);
    expect(practice.progress.stampTiers).toEqual({ KR: 'gold', DE: 'basic' });
  });
  it('기본 도장은 다음 보상 세션에서 맞히면 황금으로 업그레이드되고, 도장 수는 늘지 않는다', () => {
    const d1 = applySession(defaultProgress(), allCorrect(['KR']), D1);
    const practice = applySession(d1.progress, allCorrect(['DE']), D1);
    const d2 = applySession(practice.progress, allCorrect(['DE', 'KR']), '2026-10-14');
    expect(d2.summary.stamps).toEqual([{ countryId: 'DE', tier: 'gold', kind: 'upgrade' }]);
    expect(d2.progress.stampTiers).toEqual({ KR: 'gold', DE: 'gold' });
    expect([...d2.progress.discoveredCountryIds].sort()).toEqual(['DE', 'KR']);
    expect(d2.progress.currentStreak).toBe(2);
  });
  it('이미 가진 등급 이하의 도장은 다시 지급되지 않는다', () => {
    const d1 = applySession(defaultProgress(), allCorrect(['KR']), D1);
    const p1 = applySession(d1.progress, allCorrect(['KR']), D1);
    expect(p1.summary.stamps).toEqual([]);
    const p2 = applySession(applySession(defaultProgress(), allCorrect(['DE']), D1).progress, allCorrect(['DE']), D1);
    expect(p2.summary.stamps).toEqual([]);
  });
  it('틀린 문제는 도장을 주지 않는다 (연습 포함)', () => {
    const wrong = [{ questionId: 'q.capital.KR', countryId: 'KR', correct: false }];
    expect(applySession(defaultProgress(), wrong, D1).summary.stamps).toEqual([]);
  });
  it('복습으로 맞힌 문제는 오답 목록에서 빠진다', () => {
    const p = { ...defaultProgress(), wrongQuestionIds: ['q.capital.KR'] };
    const { progress } = applySession(p, allCorrect(['KR']), D1);
    expect(progress.wrongQuestionIds).toEqual([]);
  });
  it('입력 진행 데이터를 변경하지 않는다', () => {
    const p = defaultProgress();
    applySession(p, allCorrect(['KR']), D1);
    expect(p).toEqual(defaultProgress());
  });
});

describe('sanitizeProgress', () => {
  it('등급 정보가 없는 기존 발견 기록은 황금 도장으로 이전한다', () => {
    const r = sanitizeProgress({ discoveredCountryIds: ['KR'], stampTiers: { JP: 'silver', DE: 'basic' } });
    expect(r.stampTiers).toEqual({ DE: 'basic', KR: 'gold' });
  });
  it('깨진 저장 데이터를 기본값으로 복구한다', () => {
    expect(sanitizeProgress(null)).toEqual(defaultProgress());
    expect(sanitizeProgress('x')).toEqual(defaultProgress());
    const r = sanitizeProgress({ totalStars: -5, discoveredCountryIds: [1, 'KR'], bestCorrectCount: 'a' });
    expect(r.totalStars).toBe(0);
    expect(r.discoveredCountryIds).toEqual(['KR']);
    expect(r.bestCorrectCount).toBe(0);
  });
});
