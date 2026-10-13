import type { Content } from '../../data/content';
import type { PlayCharacter } from '../../types/character';
import type { PlayerProgress } from '../../types/progress';

/** 고를 수 있는 캐릭터: 검수 완료(verified)만. */
export function selectableCharacters(content: Content): PlayCharacter[] {
  return content.characters.filter((c) => c.status === 'verified');
}

/**
 * 지금 쓰는 캐릭터. 고른 적이 없거나, 고른 캐릭터가 콘텐츠에서 사라졌으면 첫 번째 캐릭터를 쓴다.
 * 쓸 수 있는 캐릭터가 하나도 없으면 null(화면은 기본 그림으로 대신한다).
 */
export function activeCharacter(content: Content, progress: PlayerProgress): PlayCharacter | null {
  const list = selectableCharacters(content);
  return list.find((c) => c.id === progress.characterId) ?? list[0] ?? null;
}

/** 캐릭터를 바꾼다. 없는 ID/검수 완료가 아닌 캐릭터는 고를 수 없고, 그때는 기록을 바꾸지 않는다. */
export function setCharacter(progress: PlayerProgress, content: Content, id: string): PlayerProgress {
  const ok = selectableCharacters(content).some((c) => c.id === id);
  return ok && progress.characterId !== id ? { ...progress, characterId: id } : progress;
}

/** 아직 한 번도 탐험하지 않은 새 플레이어인지 (홈에서 캐릭터 고르기를 크게 보여줄 때). */
export function isNewPlayer(progress: PlayerProgress): boolean {
  return progress.totalAnswered === 0 && progress.completedDates.length === 0;
}
