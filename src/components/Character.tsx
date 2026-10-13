import { characterImageUrl } from '../features/characters/characterAssets';
import type { PlayCharacter } from '../types/character';
import type { Companion } from '../types/companion';
import type { Cosmetic } from '../types/reward';
import { useActiveCharacter } from './CharacterContext';

type Mood = 'happy' | 'cheer' | 'think';

const BADGE: Record<Mood, string> = { happy: '🧭', cheer: '🎉', think: '💭' };

type Props = {
  mood?: Mood;
  size?: number;
  equipped?: Cosmetic[];
  companion?: Companion | null;
  /** 지정하지 않으면 플레이어가 고른 캐릭터를 쓴다 (Lab 미리보기 등에서 특정 캐릭터를 보여줄 때만 지정). */
  character?: PlayCharacter | null;
};

/**
 * 주인공 캐릭터. 장착한 장식과 함께 다니는 친구(동물)를 겹쳐 보여준다.
 * 그림은 캐릭터 데이터의 assetKey로 찾은 SVG라서 기기마다 모양이 달라지지 않는다.
 */
export function Character({ mood = 'happy', size = 96, equipped = [], companion = null, character }: Props) {
  const active = useActiveCharacter();
  const who = character ?? active;
  const url = who ? characterImageUrl(who.assetKey) : undefined;
  const name = who?.nameKo ?? '폭시';
  const label = companion ? `캐릭터 ${name}, 함께 다니는 ${companion.nameKo}` : `캐릭터 ${name}`;
  return (
    <div className={`character mood-${mood}`} style={{ fontSize: size }} role="img" aria-label={label}>
      {url ? <img className="character-face" src={url} alt="" draggable={false} /> : <span className="character-face">🦊</span>}
      {equipped.map((c) => (
        <span key={c.id} className={`cosmetic slot-${c.slot}`}>{c.emoji}</span>
      ))}
      {companion && <span className="companion">{companion.emoji}</span>}
      <span className="character-badge">{BADGE[mood]}</span>
    </div>
  );
}
