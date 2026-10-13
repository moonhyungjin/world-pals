import { useState } from 'react';
import { Character } from '../../components/Character';
import type { Content } from '../../data/content';
import type { PlayerProgress } from '../../types/progress';
import type { Cosmetic } from '../../types/reward';
import { equipCosmetic, unequipCosmetic, unlockCosmetic } from '../rewards/rewardEngine';

const SLOT_LABEL: Record<Cosmetic['slot'], string> = { head: '머리', face: '얼굴', neck: '목', back: '등' };

type Props = { progress: PlayerProgress; content: Content; onChange: (next: PlayerProgress) => void };

export function CustomizePage({ progress, content, onChange }: Props) {
  const [message, setMessage] = useState('');
  const items = content.cosmetics.filter((c) => c.status === 'verified');
  const equipped = items.filter((c) => progress.equippedCosmeticIds.includes(c.id));

  const unlock = (item: Cosmetic) => {
    const r = unlockCosmetic(progress, item);
    if (r.ok) {
      onChange(equipCosmetic(r.progress, item, items));
      setMessage(`🎉 ${item.nameKo}을(를) 얻었어요!`);
    } else if (r.reason === 'not-enough-stars') {
      setMessage(`⭐ 별이 ${item.cost - progress.totalStars}개 더 필요해요. 탐험하고 별을 모아요!`);
    }
  };

  return (
    <div className="customize">
      <h1>🎒 꾸미기</h1>
      <div className="preview card">
        <Character size={120} equipped={equipped} />
        <p className="stars-have">보유 별 ⭐ <strong>{progress.totalStars}</strong></p>
      </div>
      <p className="hint" role="status" aria-live="polite">{message}</p>

      <ul className="cosmetic-list">
        {items.map((item) => {
          const owned = progress.unlockedRewardIds.includes(item.id);
          const worn = progress.equippedCosmeticIds.includes(item.id);
          const canAfford = progress.totalStars >= item.cost;
          return (
            <li key={item.id} className="card cosmetic-item">
              <span className="cosmetic-emoji" aria-hidden="true">{item.emoji}</span>
              <div className="cosmetic-info">
                <strong>{item.nameKo}</strong>
                <small>{SLOT_LABEL[item.slot]} · {item.descriptionKo}</small>
              </div>
              {!owned && (
                <button type="button" className={`btn small ${canAfford ? 'primary' : ''}`} onClick={() => unlock(item)}>
                  ⭐ {item.cost}
                </button>
              )}
              {owned && !worn && (
                <button type="button" className="btn small" onClick={() => onChange(equipCosmetic(progress, item, items))}>
                  입기
                </button>
              )}
              {owned && worn && (
                <button type="button" className="btn small" onClick={() => onChange(unequipCosmetic(progress, item.id))}>
                  ✅ 벗기
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
