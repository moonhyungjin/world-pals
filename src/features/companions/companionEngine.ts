import type { Content } from '../../data/content';
import type { Companion } from '../../types/companion';
import type { PlayerProgress } from '../../types/progress';
import type { StampResult } from '../quiz/quizEngine';

/** 만난 친구: 나라의 도장을 받았고, 친구와 그 나라가 모두 검수 완료(verified)인 경우만. */
export function unlockedCompanions(content: Content, progress: PlayerProgress): Companion[] {
  const discovered = new Set(progress.discoveredCountryIds);
  const countryOk = new Set(content.countries.filter((c) => c.status === 'verified').map((c) => c.id));
  return content.companions.filter(
    (c) => c.status === 'verified' && countryOk.has(c.countryId) && discovered.has(c.countryId),
  );
}

/** 지금 함께 다니는 친구. 선택한 친구를 아직 못 만났거나 콘텐츠에서 사라졌으면 null. */
export function activeCompanion(content: Content, progress: PlayerProgress): Companion | null {
  if (!progress.companionId) return null;
  return unlockedCompanions(content, progress).find((c) => c.id === progress.companionId) ?? null;
}

/** 함께 다닐 친구를 고른다 (null이면 혼자). 만나지 못한 친구는 고를 수 없고, 그때는 기록을 바꾸지 않는다. */
export function setActiveCompanion(progress: PlayerProgress, content: Content, id: string | null): PlayerProgress {
  if (id === null) return progress.companionId === null ? progress : { ...progress, companionId: null };
  const ok = unlockedCompanions(content, progress).some((c) => c.id === id);
  return ok && progress.companionId !== id ? { ...progress, companionId: id } : progress;
}

/** 이번 세션에서 새로 만난 친구 (새 나라 도장을 받은 경우에만. 기본→황금 업그레이드는 새 만남이 아님). */
export function newlyMetCompanions(content: Content, stamps: StampResult[]): Companion[] {
  const fresh = new Set(stamps.filter((s) => s.kind === 'new').map((s) => s.countryId));
  const countryOk = new Set(content.countries.filter((c) => c.status === 'verified').map((c) => c.id));
  return content.companions.filter((c) => c.status === 'verified' && countryOk.has(c.countryId) && fresh.has(c.countryId));
}

/** 나라에 연결된 친구 (여권/지도 상세에서 보여줄 때). 아직 못 만났어도 돌려주니, 보여줄지는 호출하는 쪽이 정한다. */
export function companionOfCountry(content: Content, countryId: string): Companion | undefined {
  return content.companions.find((c) => c.countryId === countryId && c.status === 'verified');
}
