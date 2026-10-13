import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { seededRng } from '../../lib/random';
import { defaultProgress } from '../../lib/saveData';
import type { QuizAnswer } from '../../types/question';
import { completeSession } from '../rewards/rewardEngine';
import {
  availableTypes,
  canCreateChallenge,
  challengeCodeFromHash,
  challengeUrl,
  encodeChallenge,
  parseChallengeCode,
  resolveChallenge,
  resultMarks,
  resultShareText,
} from './challenge';

const D = '2026-10-13';
const answers = (correctFlags: boolean[]): QuizAnswer[] =>
  ['KR', 'JP', 'FR', 'DE', 'IT'].slice(0, correctFlags.length).map((id, i) => ({
    questionId: `q.capital.${id}`,
    countryId: id,
    correct: correctFlags[i],
  }));

describe('도전장 코드', () => {
  it('만들고 다시 읽으면 같은 내용이다', () => {
    const entries = [
      { countryId: 'KR', type: 'capital' as const },
      { countryId: 'JP', type: 'flag' as const },
      { countryId: 'FR', type: 'capital' as const },
    ];
    const code = encodeChallenge(entries, 2);
    expect(code).toBe('KRc.JPf.FRc~2');
    expect(parseChallengeCode(code)).toEqual({ ok: true, entries, message: 2 });
    expect(parseChallengeCode(encodeChallenge(entries))).toEqual({ ok: true, entries, message: null });
  });
  it('소문자로 바뀐 링크도 읽는다', () => {
    const r = parseChallengeCode('krc.jpf.frc');
    expect(r.ok && r.entries.map((e) => `${e.countryId}${e.type}`)).toEqual(['KRcapital', 'JPflag', 'FRcapital']);
  });
  it('이상한 코드는 이유와 함께 거절한다 (예외 없음)', () => {
    const bad: [string, string][] = [
      ['', 'empty'],
      ['   ', 'empty'],
      ['~1', 'empty'],
      ['KR', 'format'],
      ['KRx', 'format'],
      ['KRc,JPf', 'format'],
      ['KRc..JPf', 'format'],
      ['KRc.JPf~', 'format'],
      ['KRc.JPf~12', 'format'],
      ['KRc.JPf~1~2', 'format'],
      ['<script>alert(1)</script>', 'format'],
      ['KRc.KRf', 'duplicate'],
      ['AAc.BBc.CCc.DDc.EEc.FFc.GGc.HHc.IIc.JJc.KKc', 'too-many'],
    ];
    for (const [code, reason] of bad) {
      expect(parseChallengeCode(code), code).toEqual({ ok: false, reason });
    }
  });
  it('모르는 인사말 번호는 무시한다', () => {
    const r = parseChallengeCode('KRc.JPf.FRc~9');
    expect(r.ok && r.message).toBeNull();
  });
  it('해시에서 코드를 꺼내고, 깨진 주소 인코딩도 안전하다', () => {
    expect(challengeCodeFromHash('#/c/KRc.JPf.FRc')).toBe('KRc.JPf.FRc');
    expect(challengeCodeFromHash('#/lab')).toBeNull();
    expect(challengeCodeFromHash('')).toBeNull();
    expect(parseChallengeCode(challengeCodeFromHash('#/c/%E0%A4%A')!).ok).toBe(false);
  });
  it('주소를 만든다', () => {
    expect(challengeUrl('KRc.JPf.FRc', 'https://world-pals.vercel.app/')).toBe('https://world-pals.vercel.app/#/c/KRc.JPf.FRc');
  });
});

describe('resolveChallenge', () => {
  it('문제를 실제 보기와 함께 만든다 (보기 4개, 정답 한 번)', () => {
    const r = resolveChallenge('KRc.JPf.FRc', content, seededRng(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.challenge.items.map((i) => i.type)).toEqual(['capital', 'flag', 'capital']);
    for (const item of r.challenge.items) {
      expect(item.choices).toHaveLength(4);
      expect(item.choices.filter((c) => c.countryId === item.countryId)).toHaveLength(1);
    }
  });
  it('같은 링크는 누가 열어도 같은 문제와 같은 오답 보기다', () => {
    const labels = (seed: number) => {
      const r = resolveChallenge('KRc.JPf', content, seededRng(seed));
      return r.ok ? r.challenge.items.map((i) => [...i.choices.map((c) => c.countryId)].sort().join()) : [];
    };
    expect(labels(1)).toEqual(labels(99));
  });
  it('없는 나라, 출제 제외(review) 나라, 지원하지 않는 조합은 열지 않는다', () => {
    expect(resolveChallenge('ZZc.KRc', content, seededRng(1))).toEqual({ ok: false, reason: 'unknown' });
    expect(resolveChallenge('NLc.KRc', content, seededRng(1))).toEqual({ ok: false, reason: 'unknown' });
    expect(resolveChallenge('KRc.KRf', content, seededRng(1))).toEqual({ ok: false, reason: 'duplicate' });
    expect(resolveChallenge('garbage', content, seededRng(1)).ok).toBe(false);
  });
  it('나라별로 낼 수 있는 유형을 알려준다', () => {
    expect(availableTypes(content, 'KR')).toEqual(['capital', 'flag']);
    expect(availableTypes(content, 'NL')).toEqual([]);
    expect(availableTypes(content, 'ZZ')).toEqual([]);
  });
});

describe('결과 공유 문구', () => {
  it('⭕❌ 줄과 점수를 만든다', () => {
    expect(resultMarks([true, false, true])).toBe('⭕❌⭕');
    const text = resultShareText([true, true, false, true, true], 'https://x.test/#/c/KRc');
    expect(text).toContain('⭕⭕❌⭕⭕ (4/5)');
    expect(text).toContain('https://x.test/#/c/KRc');
  });
});

describe('도전장 만들기 조건 (오늘의 탐험을 잘 풀기)', () => {
  it('오늘의 탐험에서 4문제 이상 맞히면 그날 열린다', () => {
    const r = completeSession(defaultProgress(), answers([true, true, true, true, false]), D, content);
    expect(r.challengeUnlocked).toBe(true);
    expect(canCreateChallenge(r.progress, D)).toBe(true);
    expect(canCreateChallenge(r.progress, '2026-10-14')).toBe(false); // 다음 날은 다시 풀어야 함
  });
  it('3문제 이하이면 열리지 않는다', () => {
    const r = completeSession(defaultProgress(), answers([true, true, true, false, false]), D, content);
    expect(r.challengeUnlocked).toBe(false);
    expect(canCreateChallenge(r.progress, D)).toBe(false);
  });
  it('연습/복습(practice)으로는 열리지 않는다', () => {
    const r = completeSession(defaultProgress(), answers([true, true, true, true, true]), D, content, { practice: true });
    expect(r.challengeUnlocked).toBe(false);
  });
  it('같은 날 두 번째 플레이(보상 없음)로는 새로 열리지 않고, 이미 열렸으면 유지된다', () => {
    const first = completeSession(defaultProgress(), answers([true, true, true, true, true]), D, content);
    const second = completeSession(first.progress, answers([true, true, true, true, true]), D, content);
    expect(second.challengeUnlocked).toBe(false);
    expect(canCreateChallenge(second.progress, D)).toBe(true);
    expect(second.progress.challengeUnlockedDates).toEqual([D]); // 중복 기록 없음
    // 처음에 못 푼 날은 같은 날 연습을 잘해도 열리지 않는다
    const poor = completeSession(defaultProgress(), answers([true, false, false, false, false]), D, content);
    const retry = completeSession(poor.progress, answers([true, true, true, true, true]), D, content);
    expect(canCreateChallenge(retry.progress, D)).toBe(false);
  });
});
