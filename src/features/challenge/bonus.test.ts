import { describe, expect, it } from 'vitest';
import { defaultProgress, sanitizeProgress } from '../../lib/saveData';
import { applyChallengeBonus, bonusResultText, bonusStatus, challengeKey, markChallengeMade } from './bonus';

const D = '2026-10-13';
const CODE = 'KRc.JPf.FRc~1';

describe('challengeKey (같은 도전장 판단)', () => {
  it('순서와 인사말이 달라도 같은 도전장이다', () => {
    const k = challengeKey('KRc.JPf.FRc');
    expect(k).toBe('FRc.JPf.KRc');
    expect(challengeKey('FRc.KRc.JPf~3')).toBe(k);
    expect(challengeKey('krc.jpf.frc')).toBe(k);
  });
  it('유형이 다르면 다른 도전장이다', () => {
    expect(challengeKey('KRc.JPf')).not.toBe(challengeKey('KRf.JPf'));
  });
  it('잘못된 코드는 null', () => {
    expect(challengeKey('garbage')).toBeNull();
    expect(challengeKey('')).toBeNull();
    expect(challengeKey('KRc.KRf')).toBeNull();
  });
});

describe('도전장 보너스 별', () => {
  it('처음 풀면 맞힌 문제 하나당 별 1개', () => {
    expect(bonusStatus(defaultProgress(), CODE, D)).toEqual({ kind: 'available', remaining: 6 });
    const r = applyChallengeBonus(defaultProgress(), CODE, 2, D);
    expect(r.outcome.stars).toBe(2);
    expect(r.progress.totalStars).toBe(2);
    expect(r.progress.challengeBonusToday).toBe(2);
    expect(r.progress.challengeBonusDate).toBe(D);
  });
  it('입력 진행 기록을 바꾸지 않는다', () => {
    const p = defaultProgress();
    applyChallengeBonus(p, CODE, 3, D);
    expect(p).toEqual(defaultProgress());
  });
  it('같은 도전장(순서·인사말만 다른 링크 포함)은 두 번째부터 별이 없다', () => {
    const first = applyChallengeBonus(defaultProgress(), CODE, 3, D);
    for (const again of [CODE, 'FRc.KRc.JPf', 'JPf.FRc.KRc~0']) {
      const r = applyChallengeBonus(first.progress, again, 3, D);
      expect(r.outcome).toEqual({ stars: 0, status: { kind: 'done' } });
      expect(r.progress).toBe(first.progress);
    }
    // 다음 날에도 마찬가지
    expect(bonusStatus(first.progress, CODE, '2026-10-14')).toEqual({ kind: 'done' });
  });
  it('내가 만든 도전장은 별이 없다 (순서를 바꿔도)', () => {
    const made = markChallengeMade(defaultProgress(), CODE);
    expect(bonusStatus(made, CODE, D)).toEqual({ kind: 'own' });
    expect(bonusStatus(made, 'JPf.FRc.KRc', D)).toEqual({ kind: 'own' });
    expect(applyChallengeBonus(made, CODE, 3, D).outcome.stars).toBe(0);
    expect(markChallengeMade(made, CODE)).toBe(made); // 두 번 기록하지 않음
  });
  it('하루 상한(6개)까지만 받고, 상한 때문에 못 받은 도전장은 푼 것으로 치지 않아 다음 날 받을 수 있다', () => {
    let p = defaultProgress();
    p = applyChallengeBonus(p, 'KRc.JPc.FRc.DEc.ITc', 5, D).progress; // +5
    const second = applyChallengeBonus(p, 'ESc.GRc.EGc.KEc.MAc', 5, D);
    expect(second.outcome.stars).toBe(1); // 남은 1개만
    expect(second.progress.totalStars).toBe(6);
    const third = applyChallengeBonus(second.progress, 'USc.CAc.MXc', 3, D);
    expect(third.outcome).toEqual({ stars: 0, status: { kind: 'cap' } });
    expect(third.progress).toBe(second.progress); // 푼 것으로 기록하지 않음
    const nextDay = applyChallengeBonus(third.progress, 'USc.CAc.MXc', 3, '2026-10-14');
    expect(nextDay.outcome.stars).toBe(3);
    expect(nextDay.progress.challengeBonusToday).toBe(3); // 날짜가 바뀌면 새로 센다
  });
  it('0개 맞혀도 푼 것으로 기록되어 다시 풀어 별을 노릴 수 없다', () => {
    const r = applyChallengeBonus(defaultProgress(), CODE, 0, D);
    expect(r.outcome.stars).toBe(0);
    expect(bonusStatus(r.progress, CODE, D)).toEqual({ kind: 'done' });
    expect(bonusResultText(r.outcome)).toContain('이미 푼 걸로');
  });
  it('잘못된 코드에는 별을 주지 않는다', () => {
    const r = applyChallengeBonus(defaultProgress(), 'garbage', 5, D);
    expect(r.outcome).toEqual({ stars: 0, status: { kind: 'none' } });
    expect(r.progress.totalStars).toBe(0);
  });
  it('안내 문구', () => {
    expect(bonusResultText({ stars: 3, status: { kind: 'available', remaining: 6 } })).toBe('⭐ 보너스 별 3개를 받았어요!');
    expect(bonusResultText({ stars: 0, status: { kind: 'own' } })).toContain('내가 만든 도전장');
    expect(bonusResultText({ stars: 0, status: { kind: 'cap' } })).toContain('다 받았어요');
  });
  it('저장 데이터의 잘못된 값은 기본값으로 복구된다', () => {
    const p = sanitizeProgress({ challengeBonusDate: 5, challengeBonusToday: -3 });
    expect(p.challengeBonusDate).toBe('');
    expect(p.challengeBonusToday).toBe(0);
  });
});
