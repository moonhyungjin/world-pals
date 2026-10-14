import { useState } from 'react';
import { Character } from '../../components/Character';
import { CharacterPicker } from '../../components/CharacterPicker';
import type { Content } from '../../data/content';
import type { PlayerProgress } from '../../types/progress';
import type { Cosmetic } from '../../types/reward';
import { activeCharacter, selectableCharacters, setCharacter } from '../characters/characterEngine';
import { activeCompanion, setActiveCompanion, unlockedCompanions } from '../companions/companionEngine';
import { equipCosmetic, unequipCosmetic, unlockCosmetic } from '../rewards/rewardEngine';

const SLOT_LABEL: Record<Cosmetic['slot'], string> = { head: '머리', face: '얼굴', neck: '목', back: '등' };

type Props = { progress: PlayerProgress; content: Content; onChange: (next: PlayerProgress) => void };

export function CustomizePage({ progress, content, onChange }: Props) {
  const [message, setMessage] = useState('');
  const items = content.cosmetics.filter((c) => c.status === 'verified');
  const equipped = items.filter((c) => progress.equippedCosmeticIds.includes(c.id));

  // 탐험 친구: 도장을 받은 나라의 친구를 만나고, 한 마리를 골라 함께 다닌다.
  const verifiedCountries = new Map(content.countries.filter((c) => c.status === 'verified').map((c) => [c.id, c]));
  const allFriends = content.companions.filter((c) => c.status === 'verified' && verifiedCountries.has(c.countryId));
  const metIds = new Set(unlockedCompanions(content, progress).map((c) => c.id));
  const active = activeCompanion(content, progress);
  const characters = selectableCharacters(content);
  const hero = activeCharacter(content, progress);

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
        <Character size={120} equipped={equipped} companion={active} />
        <p className="stars-have">보유 별 ⭐ <strong>{progress.totalStars}</strong></p>
      </div>
      <p className="hint" role="status" aria-live="polite">{message}</p>

      {characters.length > 1 && (
        <section className="card" aria-labelledby="characters-title">
          <h2 id="characters-title" className="section-title">🧸 내 캐릭터</h2>
          <p className="hint">언제든 바꿀 수 있어요. 장식과 친구는 그대로예요.</p>
          <CharacterPicker
            characters={characters}
            activeId={hero?.id ?? null}
            onPick={(id) => {
              onChange(setCharacter(progress, content, id));
              const picked = characters.find((c) => c.id === id);
              if (picked && picked.id !== hero?.id) setMessage(`🎉 ${picked.nameKo}와 함께 떠나요!`);
            }}
          />
          {hero && (
            <p className="char-desc">
              <strong>{hero.nameKo}</strong> · {hero.descriptionKo}
            </p>
          )}
        </section>
      )}

      {allFriends.length > 0 && (
        <section className="card" aria-labelledby="friends-title">
          <h2 id="friends-title" className="section-title">🐾 탐험 친구 ({metIds.size}/{allFriends.length})</h2>
          <p className="hint">나라의 도장을 받으면 그 나라의 동물 친구를 만나요. 한 마리와 함께 다닐 수 있어요.</p>
          <ul className="friend-grid">
            {allFriends.map((f) => {
              const met = metIds.has(f.id);
              const withMe = active?.id === f.id;
              if (!met) {
                // 못 만난 친구는 모습과 이름을 숨기고 대륙만 알려준다 (어느 나라인지 힌트가 되지 않게)
                const continent = verifiedCountries.get(f.countryId)?.continent;
                return (
                  <li key={f.id}>
                    <div className="friend-cell locked" role="img" aria-label={`아직 못 만난 친구, ${continent}의 나라에서 만나요`}>
                      <span className="friend-emoji" aria-hidden="true">{f.emoji}</span>
                      <span aria-hidden="true">???</span>
                    </div>
                  </li>
                );
              }
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`friend-cell ${withMe ? 'on' : ''}`}
                    aria-pressed={withMe}
                    onClick={() => {
                      onChange(setActiveCompanion(progress, content, withMe ? null : f.id));
                      setMessage(withMe ? `${f.nameKo}가 쉬러 갔어요.` : `🐾 ${f.nameKo}와 함께 떠나요!`);
                    }}
                  >
                    <span className="friend-emoji" aria-hidden="true">{f.emoji}</span>
                    <span>{f.nameKo}</span>
                    {withMe && <span className="friend-with" aria-hidden="true">✅</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {active && (
            <p className="friend-detail" role="status">
              {active.emoji} <strong>{active.nameKo}</strong> · {active.descriptionKo}
            </p>
          )}
        </section>
      )}

      <ul className="cosmetic-list">
        {items.map((item) => {
          const owned = progress.unlockedRewardIds.includes(item.id);
          const worn = progress.equippedCosmeticIds.includes(item.id);
          const canAfford = progress.totalStars >= item.cost;
          return (
            <li key={item.id} className="card cosmetic-item">
              {/* 목록의 그림: 지금 고른 캐릭터가 이 장식을 입은 모습 */}
              <span className="cosmetic-thumb" aria-hidden="true">
                <Character size={50} equipped={[item]} />
              </span>
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
