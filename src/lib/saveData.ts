import { CONFIG } from '../config';
import type { PlayerProgress, StampTier } from '../types/progress';
import { STORAGE_KEYS } from './storageKeys';

export function defaultProgress(): PlayerProgress {
  return {
    version: CONFIG.progressVersion,
    totalStars: 0,
    discoveredCountryIds: [],
    stampTiers: {},
    collectedBadgeIds: [],
    unlockedRewardIds: [],
    equippedCosmeticIds: [],
    wrongQuestionIds: [],
    completedDates: [],
    bestCorrectCount: 0,
    currentStreak: 0,
    totalAnswered: 0,
    reviewCorrectCount: 0,
    rewardEventIds: [],
    characterId: null,
    companionId: null,
    challengeBonusDate: '',
    challengeBonusToday: 0,
    challengeUnlockedDates: [],
  };
}

const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const nonNegInt = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

function sanitizeTiers(v: unknown, discovered: string[]): Record<string, StampTier> {
  const out: Record<string, StampTier> = {};
  if (typeof v === 'object' && v !== null) {
    for (const [id, tier] of Object.entries(v as Record<string, unknown>)) {
      if (tier === 'basic' || tier === 'gold') out[id] = tier;
    }
  }
  // 등급 정보가 없는 기존 발견 기록은 황금(기존 규칙: 보상 세션에서만 발견)으로 간주
  for (const id of discovered) out[id] ??= 'gold';
  return out;
}

/** 알 수 없는 값을 안전한 PlayerProgress로 복구한다. 필드 단위로 기본값을 채운다. */
export function sanitizeProgress(raw: unknown): PlayerProgress {
  if (typeof raw !== 'object' || raw === null) return defaultProgress();
  const r = raw as Record<string, unknown>;
  const discovered = stringArray(r.discoveredCountryIds);
  return {
    version: CONFIG.progressVersion,
    totalStars: nonNegInt(r.totalStars),
    discoveredCountryIds: discovered,
    stampTiers: sanitizeTiers(r.stampTiers, discovered),
    collectedBadgeIds: stringArray(r.collectedBadgeIds),
    unlockedRewardIds: stringArray(r.unlockedRewardIds),
    equippedCosmeticIds: stringArray(r.equippedCosmeticIds),
    wrongQuestionIds: stringArray(r.wrongQuestionIds),
    completedDates: stringArray(r.completedDates),
    bestCorrectCount: nonNegInt(r.bestCorrectCount),
    currentStreak: nonNegInt(r.currentStreak),
    totalAnswered: nonNegInt(r.totalAnswered),
    reviewCorrectCount: nonNegInt(r.reviewCorrectCount),
    rewardEventIds: stringArray(r.rewardEventIds),
    characterId: typeof r.characterId === 'string' && r.characterId ? r.characterId : null,
    companionId: typeof r.companionId === 'string' && r.companionId ? r.companionId : null,
    challengeBonusDate: typeof r.challengeBonusDate === 'string' ? r.challengeBonusDate : '',
    challengeBonusToday: nonNegInt(r.challengeBonusToday),
    challengeUnlockedDates: stringArray(r.challengeUnlockedDates),
  };
}

export function loadProgress(key: string = STORAGE_KEYS.progress): PlayerProgress {
  try {
    const text = localStorage.getItem(key);
    if (!text) return defaultProgress();
    return sanitizeProgress(JSON.parse(text));
  } catch {
    return defaultProgress(); // 읽기 실패/깨진 JSON이어도 앱은 계속 동작
  }
}

/**
 * 저장소에 실제로 들어 있는 최신 기록을 읽는다. 기록이 없거나 읽을 수 없으면 null.
 * (loadProgress는 실패 시 기본값을 돌려주므로, "저장된 게 있는지"를 구분해야 할 때 이 함수를 쓴다.)
 */
export function readStoredProgress(key: string = STORAGE_KEYS.progress): PlayerProgress | null {
  try {
    const text = localStorage.getItem(key);
    return text ? sanitizeProgress(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveProgress(progress: PlayerProgress, key: string = STORAGE_KEYS.progress): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false; // 저장소 사용 불가(시크릿 모드, 용량 초과 등)
  }
}
