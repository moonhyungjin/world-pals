import { characterImageUrl } from '../features/characters/characterAssets';
import { COSMETIC_BOX, cosmeticImageUrl } from '../features/rewards/cosmeticAssets';
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

/** 장식 그림 한 장. 캐릭터와 같은 좌표계라 캐릭터 위에 그대로 겹치고, 캐릭터별 보정값(fit)만큼 옮기고 키운다. */
function CosmeticArt({ item, who }: { item: Cosmetic; who: PlayCharacter | null }) {
  const url = cosmeticImageUrl(item.assetKey);
  if (!url) {
    // 그림이 없는 장식은 예전처럼 이모지를 정해진 자리에 얹는다
    return <span className={`cosmetic slot-${item.slot}`}>{item.emoji}</span>;
  }
  const fit = who?.fit?.[item.slot];
  // 장식 상자는 캐릭터의 160%(320단위)이므로 캐릭터 단위 1은 상자의 1/320
  const transform = fit ? `translate(${(fit.dx * 100) / 320}%, ${(fit.dy * 100) / 320}%) scale(${fit.s})` : undefined;
  return (
    <img
      className={`cosmetic-art slot-${item.slot}`}
      src={url}
      alt=""
      draggable={false}
      style={{ left: `${COSMETIC_BOX.offset}%`, top: `${COSMETIC_BOX.offset}%`, width: `${COSMETIC_BOX.size}%`, height: `${COSMETIC_BOX.size}%`, transform }}
    />
  );
}

/**
 * 주인공 캐릭터. 장착한 장식과 함께 다니는 친구(동물)를 겹쳐 보여준다.
 * 캐릭터와 장식은 모두 SVG라서 기기마다 모양이 달라지지 않는다. 배낭(back)은 캐릭터 뒤에, 나머지는 앞에 그린다.
 */
export function Character({ mood = 'happy', size = 96, equipped = [], companion = null, character }: Props) {
  const active = useActiveCharacter();
  const who = character ?? active;
  const url = who ? characterImageUrl(who.assetKey) : undefined;
  const name = who?.nameKo ?? '폭시';
  const label = companion ? `캐릭터 ${name}, 함께 다니는 ${companion.nameKo}` : `캐릭터 ${name}`;
  const behind = equipped.filter((c) => c.slot === 'back');
  const front = equipped.filter((c) => c.slot !== 'back');
  return (
    <div className={`character mood-${mood}`} style={{ fontSize: size }} role="img" aria-label={label}>
      {behind.map((c) => (
        <CosmeticArt key={c.id} item={c} who={who} />
      ))}
      {url ? <img className="character-face" src={url} alt="" draggable={false} /> : <span className="character-face">🦊</span>}
      {front.map((c) => (
        <CosmeticArt key={c.id} item={c} who={who} />
      ))}
      {companion && <span className="companion">{companion.emoji}</span>}
      <span className="character-badge">{BADGE[mood]}</span>
    </div>
  );
}
