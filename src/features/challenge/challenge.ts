import { CONFIG } from '../../config';
import type { Content } from '../../data/content';
import type { Rng } from '../../lib/random';
import type { PlayerProgress } from '../../types/progress';
import type { QuestionType, QuizItem } from '../../types/question';
import { buildQuizItem, eligibleQuestions } from '../quiz/quizEngine';

/**
 * 도전장: 친구에게 보내는 문제 묶음. 서버 없이 링크 주소에만 담긴다.
 *
 *   #/c/KRc.JPf.FRc~1      (나라 코드 2글자 + 유형 c=수도/f=국기, 점으로 구분, ~뒤는 인사말 번호)
 *
 * 주소에는 정해진 ID만 들어가고 직접 쓰는 글이 없어서 개인정보나 부적절한 문구가 들어갈 수 없다.
 * 오답 보기는 문제 데이터에 이미 고정돼 있어서 누가 열어도 같은 문제가 나온다.
 */

export const CHALLENGE_HASH_PREFIX = '#/c/';
const PARSE_MAX = 10; // 만들 때는 challengeMaxQuestions까지, 읽을 때는 여유를 둔다

export const CHALLENGE_MESSAGES = [
  '나보다 잘 맞힐 수 있을까?',
  '같이 세계 여행을 떠나자!',
  '이 문제 어려울걸?',
  '도전해 봐!',
] as const;

export type ChallengeEntry = { countryId: string; type: QuestionType };

const TYPE_TO_CODE: Record<QuestionType, string> = { capital: 'c', flag: 'f' };
const CODE_TO_TYPE: Record<string, QuestionType> = { c: 'capital', f: 'flag' };

export function encodeChallenge(entries: ChallengeEntry[], messageIndex: number | null = null): string {
  const body = entries.map((e) => `${e.countryId.toUpperCase()}${TYPE_TO_CODE[e.type]}`).join('.');
  return messageIndex === null ? body : `${body}~${messageIndex}`;
}

export type ParseFailure = 'empty' | 'format' | 'too-many' | 'duplicate';
export type ParsedCode = { ok: true; entries: ChallengeEntry[]; message: number | null } | { ok: false; reason: ParseFailure };

/** 주소의 모양만 검사한다. 어떤 나라/문제가 실제로 있는지는 resolveChallenge에서 본다. */
export function parseChallengeCode(code: string): ParsedCode {
  const [body, messagePart, ...rest] = code.trim().split('~');
  if (rest.length > 0) return { ok: false, reason: 'format' };
  if (!body) return { ok: false, reason: 'empty' };

  let message: number | null = null;
  if (messagePart !== undefined) {
    if (!/^\d$/.test(messagePart)) return { ok: false, reason: 'format' };
    const n = Number(messagePart);
    message = n < CHALLENGE_MESSAGES.length ? n : null; // 모르는 인사말 번호는 무시
  }

  const tokens = body.split('.');
  if (tokens.length > PARSE_MAX) return { ok: false, reason: 'too-many' };
  const entries: ChallengeEntry[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const m = /^([A-Za-z]{2})([cfCF])$/.exec(token);
    if (!m) return { ok: false, reason: 'format' };
    const countryId = m[1].toUpperCase();
    if (seen.has(countryId)) return { ok: false, reason: 'duplicate' };
    seen.add(countryId);
    entries.push({ countryId, type: CODE_TO_TYPE[m[2].toLowerCase()] });
  }
  return { ok: true, entries, message };
}

export type Challenge = { code: string; items: QuizItem[]; message: number | null };
export type ChallengeFailure = ParseFailure | 'unknown';
export type ResolveResult = { ok: true; challenge: Challenge } | { ok: false; reason: ChallengeFailure };

/** 링크를 실제 문제로 바꾼다. 출제 가능한(verified) 문제만 쓰고, 하나라도 없으면 열지 않는다. */
export function resolveChallenge(code: string, content: Content, rng: Rng): ResolveResult {
  const parsed = parseChallengeCode(code);
  if (!parsed.ok) return parsed;
  const pool = eligibleQuestions(content);
  const items: QuizItem[] = [];
  for (const entry of parsed.entries) {
    const q = pool.find((x) => x.countryId === entry.countryId && x.type === entry.type);
    if (!q) return { ok: false, reason: 'unknown' };
    items.push(buildQuizItem(q, content, rng));
  }
  return { ok: true, challenge: { code, items, message: parsed.message } };
}

/** 주소의 해시(#/c/...)에서 도전장 코드만 꺼낸다. 도전장 주소가 아니면 null. */
export function challengeCodeFromHash(hash: string): string | null {
  if (!hash.startsWith(CHALLENGE_HASH_PREFIX)) return null;
  try {
    return decodeURIComponent(hash.slice(CHALLENGE_HASH_PREFIX.length));
  } catch {
    return '%'; // 깨진 주소는 형식 오류로 처리되게 한다
  }
}

export function challengeUrl(code: string, base: string = `${window.location.origin}${window.location.pathname}`): string {
  return `${base}${CHALLENGE_HASH_PREFIX}${code}`;
}

/** 오늘 도전장을 만들 수 있는지: 오늘의 탐험을 잘 풀어서 열린 날만. */
export function canCreateChallenge(progress: PlayerProgress, today: string): boolean {
  return progress.challengeUnlockedDates.includes(today);
}

/** 이 나라로 낼 수 있는 문제 유형 (출제 가능한 문제가 있는 유형만). */
export function availableTypes(content: Content, countryId: string): QuestionType[] {
  const types = eligibleQuestions(content)
    .filter((q) => q.countryId === countryId)
    .map((q) => q.type);
  return (['capital', 'flag'] as const).filter((t) => types.includes(t));
}

/** 결과를 ⭕❌로 보여주는 한 줄 (이모지 공유용). */
export function resultMarks(correct: boolean[]): string {
  return correct.map((c) => (c ? '⭕' : '❌')).join('');
}

export function resultShareText(correct: boolean[], url: string, resultCode?: string): string {
  const n = correct.filter(Boolean).length;
  const codeLine = resultCode ? `\n확인코드: ${resultCode}` : '';
  return `World Pals 도전장 결과 ${resultMarks(correct)} (${n}/${correct.length})${codeLine}\n너도 도전해 봐! 👉 ${url}`;
}

export const limits = {
  min: CONFIG.challengeMinQuestions,
  max: CONFIG.challengeMaxQuestions,
};
