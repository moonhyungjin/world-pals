import type { Content } from '../../data/content';
import type { PlayerProgress } from '../../types/progress';
import type { QuizAnswer } from '../../types/question';
import type { Badge, BadgeCondition, Cosmetic } from '../../types/reward';
import { applySession, type SessionSummary } from '../quiz/quizEngine';

function isConditionMet(cond: BadgeCondition, progress: PlayerProgress, content: Content): boolean {
  switch (cond.type) {
    case 'sessionsCompleted':
      return progress.completedDates.length >= cond.count;
    case 'countriesDiscovered':
      return progress.discoveredCountryIds.length >= cond.count;
    case 'continentDiscovered': {
      const continentOf = new Map(content.countries.map((c) => [c.id, c.continent]));
      const n = progress.discoveredCountryIds.filter((id) => continentOf.get(id) === cond.continent).length;
      return n >= cond.count;
    }
    case 'questionsAnswered':
      return progress.totalAnswered >= cond.count;
    case 'reviewCorrect':
      return progress.reviewCorrectCount >= cond.count;
  }
}

/** 조건을 만족했지만 아직 받지 않은 배지를 지급한다. 이미 가진 배지는 다시 지급하지 않는다. */
export function awardBadges(
  progress: PlayerProgress,
  content: Content,
): { progress: PlayerProgress; newBadges: Badge[] } {
  const owned = new Set(progress.collectedBadgeIds);
  const newBadges = content.badges.filter(
    (b) => b.status === 'verified' && !owned.has(b.id) && isConditionMet(b.condition, progress, content),
  );
  if (newBadges.length === 0) return { progress, newBadges };
  return {
    progress: { ...progress, collectedBadgeIds: [...progress.collectedBadgeIds, ...newBadges.map((b) => b.id)] },
    newBadges,
  };
}

export type CompletedSession = { progress: PlayerProgress; summary: SessionSummary; newBadges: Badge[] };

/** 세션 결과 반영 + 배지 지급을 한 번에 처리한다. */
export function completeSession(
  progress: PlayerProgress,
  answers: QuizAnswer[],
  today: string,
  content: Content,
  options: { practice?: boolean } = {},
): CompletedSession {
  const applied = applySession(progress, answers, today, options);
  const awarded = awardBadges(applied.progress, content);
  return { progress: awarded.progress, summary: applied.summary, newBadges: awarded.newBadges };
}

export type UnlockResult =
  | { ok: true; progress: PlayerProgress }
  | { ok: false; reason: 'unknown' | 'owned' | 'not-enough-stars' };

/** 별을 사용해 장식을 해금한다. 이미 해금했거나 별이 모자라면 아무것도 바꾸지 않는다. */
export function unlockCosmetic(progress: PlayerProgress, item: Cosmetic | undefined): UnlockResult {
  if (!item || item.status !== 'verified') return { ok: false, reason: 'unknown' };
  if (progress.unlockedRewardIds.includes(item.id)) return { ok: false, reason: 'owned' };
  if (progress.totalStars < item.cost) return { ok: false, reason: 'not-enough-stars' };
  return {
    ok: true,
    progress: {
      ...progress,
      totalStars: progress.totalStars - item.cost,
      unlockedRewardIds: [...progress.unlockedRewardIds, item.id],
    },
  };
}

/** 해금한 장식만 장착할 수 있고, 같은 슬롯의 기존 장식은 교체된다. */
export function equipCosmetic(progress: PlayerProgress, item: Cosmetic, all: Cosmetic[]): PlayerProgress {
  if (!progress.unlockedRewardIds.includes(item.id)) return progress;
  const sameSlot = new Set(all.filter((c) => c.slot === item.slot).map((c) => c.id));
  return {
    ...progress,
    equippedCosmeticIds: [...progress.equippedCosmeticIds.filter((id) => !sameSlot.has(id)), item.id],
  };
}

export function unequipCosmetic(progress: PlayerProgress, itemId: string): PlayerProgress {
  return { ...progress, equippedCosmeticIds: progress.equippedCosmeticIds.filter((id) => id !== itemId) };
}
