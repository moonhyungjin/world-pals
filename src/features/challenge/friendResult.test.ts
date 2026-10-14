import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import { defaultProgress, sanitizeProgress } from '../../lib/saveData';
import { markChallengeMade } from './bonus';
import { resultShareText } from './challenge';
import { claimFriendResult, claimMessage, ensureSolverId, hasMadeChallenge, makeResultCode, parseResultText } from './friendResult';

const D = '2026-10-14';
const KEY = 'FRc.JPf.KRc';
const mine = () => markChallengeMade(defaultProgress(), 'KRc.JPf.FRc');
const code = (score: number, solverId = 'friend01a', key = KEY, total = 3) => makeResultCode({ key, score, total, solverId });

describe('확인코드 만들기/읽기', () => {
  it('만든 코드는 그대로 읽힌다', () => {
    const r = parseResultText(code(2));
    expect(r).toEqual({ ok: true, result: { key: KEY, score: 2, total: 3, solverId: 'friend01a' } });
  });
  it('앞뒤에 다른 글이 있고 줄바꿈/소문자여도 읽힌다', () => {
    const text = `World Pals 도전장 결과 ⭕⭕❌ (2/3)\n확인코드: ${code(2).toLowerCase()}\n너도 도전해 봐!`;
    expect(parseResultText(text).ok).toBe(true);
  });
  it('점수나 도전장을 고치면 서명이 맞지 않는다', () => {
    expect(parseResultText(code(2).replace('-2-3-', '-3-3-'))).toEqual({ ok: false, reason: 'signature' });
    expect(parseResultText(code(2).replace('FRc', 'FRf'))).toEqual({ ok: false, reason: 'signature' });
  });
  it('코드가 없거나 깨져도 멈추지 않는다', () => {
    expect(parseResultText('')).toEqual({ ok: false, reason: 'none' });
    expect(parseResultText('안녕')).toEqual({ ok: false, reason: 'none' });
    expect(parseResultText('WP1-garbage')).toEqual({ ok: false, reason: 'format' });
    expect(parseResultText('WP1-KRc.KRf-1-1-abcd1234-abcdef')).toEqual({ ok: false, reason: 'format' });
    expect(parseResultText('WP1-KRc-5-3-abcd1234-abcdef')).toEqual({ ok: false, reason: 'format' }); // 맞힌 수 > 문제 수
  });
  it('공유 글에 확인코드가 한 줄 들어간다', () => {
    const text = resultShareText([true, true, false], 'https://x.test/#/c/KRc', code(2));
    expect(text).toContain(`확인코드: ${code(2)}`);
    expect(resultShareText([true], 'https://x.test')).not.toContain('확인코드');
  });
});

describe('기기 번호', () => {
  it('처음 한 번만 만들고 계속 같다', () => {
    const a = ensureSolverId(defaultProgress());
    expect(a.solverId).toMatch(/^[a-z0-9]{8}$/);
    expect(ensureSolverId(a)).toBe(a);
  });
  it('저장 데이터 읽기에서 이상한 값은 버린다', () => {
    expect(sanitizeProgress({ solverId: 'ab' }).solverId).toBe('');
    expect(sanitizeProgress({ solverId: '<script>' }).solverId).toBe('');
    expect(sanitizeProgress({ solverId: 'abcd1234' }).solverId).toBe('abcd1234');
  });
});

describe('친구 결과로 별 받기', () => {
  it('내가 만든 도전장을 친구가 풀면 별을 받는다 (만점이면 보너스)', () => {
    const r = claimFriendResult(mine(), code(2), D);
    expect(r.outcome.stars).toBe(CONFIG.friendResultStars);
    expect(r.progress.totalStars).toBe(CONFIG.friendResultStars);
    const p = claimFriendResult(mine(), code(3, 'friend02b'), D);
    expect(p.outcome).toMatchObject({ stars: CONFIG.friendResultStars + CONFIG.friendResultPerfectBonus, status: { kind: 'claimed', perfect: true } });
  });
  it('입력 기록을 바꾸지 않는다', () => {
    const p = mine();
    const copy = structuredClone(p);
    claimFriendResult(p, code(2), D);
    expect(p).toEqual(copy);
  });
  it('내가 만들지 않은 도전장은 안 된다', () => {
    expect(claimFriendResult(defaultProgress(), code(2), D).outcome).toEqual({ stars: 0, status: { kind: 'not-mine' } });
  });
  it('내가 푼 결과로는 받을 수 없다', () => {
    const p = ensureSolverId(mine());
    expect(claimFriendResult(p, code(3, p.solverId), D).outcome.status.kind).toBe('self');
  });
  it('같은 친구의 결과는 한 번만 (다시 풀어 점수를 올려도 마찬가지)', () => {
    const first = claimFriendResult(mine(), code(1), D);
    expect(claimFriendResult(first.progress, code(1), D).outcome.status.kind).toBe('already');
    expect(claimFriendResult(first.progress, code(3), D).outcome.status.kind).toBe('already');
  });
  it('한 도전장에서 받을 수 있는 친구 수가 정해져 있다', () => {
    let p = mine();
    for (let i = 0; i < CONFIG.friendResultsPerChallenge; i++) {
      p = claimFriendResult(p, code(1, `friend0${i}x`), D).progress;
    }
    expect(claimFriendResult(p, code(1, 'friend99z'), D).outcome.status.kind).toBe('full');
  });
  it('하루 상한을 넘기지 않고, 못 받은 결과는 다른 날 받을 수 있다', () => {
    const cfg = { ...CONFIG, friendResultsPerChallenge: 10, friendBonusDailyMax: 3 };
    let p = mine();
    p = claimFriendResult(p, code(3, 'friend01a'), D, cfg).progress; // 2
    const second = claimFriendResult(p, code(3, 'friend02b'), D, cfg); // 남은 1만
    expect(second.outcome.stars).toBe(1);
    expect(second.progress.friendBonusToday).toBe(3);
    const third = claimFriendResult(second.progress, code(1, 'friend03c'), D, cfg);
    expect(third.outcome).toEqual({ stars: 0, status: { kind: 'cap' } });
    const nextDay = claimFriendResult(third.progress, code(1, 'friend03c'), '2026-10-15', cfg);
    expect(nextDay.outcome.stars).toBe(1);
  });
  it('잘못된 글은 별도 기록도 바뀌지 않는다', () => {
    const p = mine();
    const r = claimFriendResult(p, 'WP1-garbage', D);
    expect(r.progress).toBe(p);
    expect(r.outcome.stars).toBe(0);
  });
  it('도전장을 만들었는지 알 수 있다', () => {
    expect(hasMadeChallenge(defaultProgress())).toBe(false);
    expect(hasMadeChallenge(mine())).toBe(true);
  });
  it('모든 결과에 아이용 안내 문구가 있다', () => {
    const kinds = [
      claimFriendResult(mine(), code(3), D).outcome,
      claimFriendResult(mine(), '', D).outcome,
      claimFriendResult(mine(), 'WP1-x', D).outcome,
      claimFriendResult(defaultProgress(), code(1), D).outcome,
    ];
    for (const o of kinds) expect(claimMessage(o).text.length).toBeGreaterThan(5);
  });
});
