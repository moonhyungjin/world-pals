import type { Cosmetic } from '../types/reward';

type Mood = 'happy' | 'cheer' | 'think';

const BADGE: Record<Mood, string> = { happy: '🧭', cheer: '🎉', think: '💭' };

type Props = { mood?: Mood; size?: number; equipped?: Cosmetic[] };

/** 탐험 파트너 '폭시'. 장착한 장식을 슬롯 위치에 겹쳐 보여준다. 이후 레이어 이미지로 교체 가능. */
export function Character({ mood = 'happy', size = 96, equipped = [] }: Props) {
  return (
    <div className={`character mood-${mood}`} style={{ fontSize: size }} role="img" aria-label="탐험 친구 폭시">
      <span className="character-face">🦊</span>
      {equipped.map((c) => (
        <span key={c.id} className={`cosmetic slot-${c.slot}`}>{c.emoji}</span>
      ))}
      <span className="character-badge">{BADGE[mood]}</span>
    </div>
  );
}
