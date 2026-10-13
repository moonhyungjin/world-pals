import { CONFIG } from '../../config';
import type { PlayerProgress } from '../../types/progress';
import { parseChallengeCode } from './challenge';

/**
 * 도전장 보너스 별: 친구가 보낸 도전장을 풀 때 받는 별.
 * 서버가 없어서 "만든 사람"에게는 줄 수 없고, 푸는 사람에게만 준다. 별을 반복해서 받는 것은 아래 규칙으로 막는다.
 */

const madeEvent = (key: string) => `challenge-made:${key}`;
const solvedEvent = (key: string) => `challenge-solved:${key}`;

/**
 * 같은 도전장인지 판단하는 기준. 문제 순서나 인사말만 다른 링크도 같은 도전장으로 본다. (잘못된 코드는 null)
 */
export function challengeKey(code: string): string | null {
  const parsed = parseChallengeCode(code);
  if (!parsed.ok) return null;
  return parsed.entries
    .map((e) => `${e.countryId}${e.type === 'capital' ? 'c' : 'f'}`)
    .sort()
    .join('.');
}

export type BonusStatus =
  | { kind: 'available'; remaining: number } // 오늘 더 받을 수 있는 별 (맞힌 만큼)
  | { kind: 'own' } // 내가 만든 도전장
  | { kind: 'done' } // 이미 푼 도전장
  | { kind: 'cap' } // 오늘의 보너스를 다 받음
  | { kind: 'none' }; // 보너스 대상이 아님(잘못된 코드)

function remainingToday(progress: PlayerProgress, today: string, max: number): number {
  const got = progress.challengeBonusDate === today ? progress.challengeBonusToday : 0;
  return Math.max(0, max - got);
}

export function bonusStatus(
  progress: PlayerProgress,
  code: string,
  today: string,
  max: number = CONFIG.challengeBonusDailyMax,
): BonusStatus {
  const key = challengeKey(code);
  if (!key) return { kind: 'none' };
  if (progress.rewardEventIds.includes(madeEvent(key))) return { kind: 'own' };
  if (progress.rewardEventIds.includes(solvedEvent(key))) return { kind: 'done' };
  const remaining = remainingToday(progress, today, max);
  return remaining > 0 ? { kind: 'available', remaining } : { kind: 'cap' };
}

/** 내가 도전장을 만들었다고 기록한다. 이 도전장을 같은 기기에서 풀어도 보너스 별을 받지 못한다. */
export function markChallengeMade(progress: PlayerProgress, code: string): PlayerProgress {
  const key = challengeKey(code);
  if (!key || progress.rewardEventIds.includes(madeEvent(key))) return progress;
  return { ...progress, rewardEventIds: [...progress.rewardEventIds, madeEvent(key)] };
}

const createBonusEvent = (today: string) => `challenge-create-bonus:${today}`;

/**
 * 도전장을 만든 사람에게 하루 한 번 주는 보너스 별. 입력을 바꾸지 않는다.
 * 서버가 없어서 "친구가 풀었는지"는 알 수 없으므로, 링크를 만드는 순간(하루 첫 번째)에만 준다.
 */
export function applyCreateBonus(
  progress: PlayerProgress,
  today: string,
  config: { challengeCreateBonusStars: number } = CONFIG,
): { progress: PlayerProgress; stars: number } {
  if (progress.rewardEventIds.includes(createBonusEvent(today))) return { progress, stars: 0 };
  const stars = config.challengeCreateBonusStars;
  return {
    progress: {
      ...progress,
      totalStars: progress.totalStars + stars,
      rewardEventIds: [...progress.rewardEventIds, createBonusEvent(today)],
    },
    stars,
  };
}

export type BonusOutcome = { stars: number; status: BonusStatus };

/**
 * 도전장을 다 푼 뒤 보너스 별을 지급한다. 입력을 바꾸지 않는다.
 * - 맞힌 문제 하나당 challengeStarsPerCorrect개, 하루 상한까지만
 * - 한 도전장은 한 번만 (끝까지 풀었으면 별이 0개여도 푼 것으로 기록)
 * - 오늘 상한을 이미 채웠을 때는 푼 것으로 기록하지 않아서, 다른 날 다시 풀면 받을 수 있다
 */
export function applyChallengeBonus(
  progress: PlayerProgress,
  code: string,
  correctCount: number,
  today: string,
  config: { challengeStarsPerCorrect: number; challengeBonusDailyMax: number } = CONFIG,
): { progress: PlayerProgress; outcome: BonusOutcome } {
  const status = bonusStatus(progress, code, today, config.challengeBonusDailyMax);
  const key = challengeKey(code);
  if (status.kind !== 'available' || !key) return { progress, outcome: { stars: 0, status } };
  const stars = Math.min(Math.max(0, correctCount) * config.challengeStarsPerCorrect, status.remaining);
  const sameDay = progress.challengeBonusDate === today;
  return {
    progress: {
      ...progress,
      totalStars: progress.totalStars + stars,
      challengeBonusDate: today,
      challengeBonusToday: (sameDay ? progress.challengeBonusToday : 0) + stars,
      rewardEventIds: [...progress.rewardEventIds, solvedEvent(key)],
    },
    outcome: { stars, status },
  };
}

/** 도전장 소개 화면에서 보여줄 보너스 안내. */
export function bonusIntroText(status: BonusStatus): string {
  switch (status.kind) {
    case 'available':
      return `맞힌 만큼 보너스 별을 받아요! (오늘 최대 ⭐ ${status.remaining}개) 나라 도장도 받아요.`;
    case 'own':
      return '내가 만든 도전장이라 보너스 별은 없어요. 나라 도장은 받을 수 있어요!';
    case 'done':
      return '이미 푼 도전장이에요. 보너스 별은 없지만 연습하고 도장을 받을 수 있어요!';
    case 'cap':
      return '오늘의 보너스 별은 다 받았어요. 나라 도장은 받을 수 있어요!';
    default:
      return '맞히면 나라 도장을 받아요!';
  }
}

/** 도전장 결과 화면에서 보여줄 보너스 안내. */
export function bonusResultText(outcome: BonusOutcome): string {
  const { status, stars } = outcome;
  if (status.kind === 'available') {
    return stars > 0
      ? `⭐ 보너스 별 ${stars}개를 받았어요!`
      : '이번에는 보너스 별이 없어요. 이 도전장은 이미 푼 걸로 해요. 나라 도장은 받았어요! 😊';
  }
  return bonusIntroText(status);
}
