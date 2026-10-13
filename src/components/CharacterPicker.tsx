import { characterImageUrl } from '../features/characters/characterAssets';
import type { PlayCharacter } from '../types/character';

type Props = {
  characters: PlayCharacter[];
  activeId: string | null;
  onPick: (id: string) => void;
};

/** 캐릭터 고르기. 홈(처음 시작)과 꾸미기에서 같은 모양으로 쓴다. */
export function CharacterPicker({ characters, activeId, onPick }: Props) {
  return (
    <ul className="char-picker">
      {characters.map((c) => {
        const url = characterImageUrl(c.assetKey);
        const on = c.id === activeId;
        return (
          <li key={c.id}>
            <button type="button" className={`char-option ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onPick(c.id)}>
              {url ? <img src={url} alt="" draggable={false} /> : <span className="char-fallback" aria-hidden="true">🦊</span>}
              <span className="char-name">{c.nameKo}</span>
              {on && <span className="char-check" aria-hidden="true">✅</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
