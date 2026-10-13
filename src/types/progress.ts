/** basic: 연습에서 얻은 기본 도장, gold: 오늘의 탐험(보상 있는 세션)에서 얻은 황금 도장 */
export type StampTier = 'basic' | 'gold';

export type PlayerProgress = {
  version: number;
  totalStars: number;
  discoveredCountryIds: string[];
  stampTiers: Record<string, StampTier>; // 국가 ID -> 도장 등급
  collectedBadgeIds: string[];
  unlockedRewardIds: string[];
  equippedCosmeticIds: string[];
  wrongQuestionIds: string[];
  completedDates: string[]; // YYYY-MM-DD (기기 로컬 날짜)
  bestCorrectCount: number;
  currentStreak: number;
  totalAnswered: number;
  reviewCorrectCount: number; // 복습 대상 문제를 다시 맞힌 횟수
  rewardEventIds: string[]; // 지급 완료된 보상 이벤트 (중복 지급 방지)
};
