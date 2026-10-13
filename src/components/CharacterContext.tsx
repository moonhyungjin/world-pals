import { createContext, useContext } from 'react';
import { content } from '../data/content';
import { selectableCharacters } from '../features/characters/characterEngine';
import type { PlayCharacter } from '../types/character';

/**
 * 지금 고른 주인공 캐릭터. 앱(App)이 값을 넣어 주고, 어디서든 <Character />가 그 모습으로 그려진다.
 * 값이 없는 곳(예: Lab의 미리보기)에서는 기본 캐릭터(첫 번째)를 쓴다.
 */
export const CharacterContext = createContext<PlayCharacter | null>(null);

export function useActiveCharacter(): PlayCharacter | null {
  const picked = useContext(CharacterContext);
  return picked ?? selectableCharacters(content)[0] ?? null;
}
