import type { Companion } from '../types/companion';
import type { Cosmetic } from '../types/reward';

type Mood = 'happy' | 'cheer' | 'think';

const BADGE: Record<Mood, string> = { happy: '🧭', cheer: '🎉', think: '💭' };

type Props = { mood?: Mood; size?: number; equipped?: Cosmetic[]; companion?: Companion | null };

/** 탐험 파트너 '폭시'. 장착한 장식과 함께 다니는 친구(동물)를 겹쳐 보여준다. 이후 레이어 이미지로 교체 가능. */
export function Character({ mood = 'happy', size = 96, equipped = [], companion = null }: Props) {
  const label = companion ? `탐험 친구 폭시, 함께 다니는 ${companion.nameKo}` : '탐험 친구 폭시';
  return (
    <div className={`character mood-${mood}`} style={{ fontSize: size }} role="img" aria-label={label}>
      <span className="character-face">🦊</span>
      {equipped.map((c) => (
        <span key={c.id} className={`cosmetic slot-${c.slot}`}>{c.emoji}</span>
      ))}
      {companion && <span className="companion">{companion.emoji}</span>}
      <span className="character-badge">{BADGE[mood]}</span>
    </div>
  );
}
