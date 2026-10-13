import type { Companion } from '../types/companion';
import type { Country } from '../types/country';
import type { StampTier } from '../types/progress';
import { Flag, LockedFlag } from './Flag';

/** 여권/지도에서 국가를 눌렀을 때 보여주는 상세 카드. 발견 전에는 수도를 알려주지 않는다. */
export function CountryDetail({
  country,
  tier,
  companion,
  onClose,
}: {
  country: Country;
  tier?: StampTier;
  companion?: Companion;
  onClose: () => void;
}) {
  return (
    <section className="card detail" role="status">
      {tier ? <Flag country={country} className="big-flag" /> : <span className="big-flag"><LockedFlag /></span>}
      <h2>{tier ? country.nameKo : '???'}</h2>
      {tier ? (
        <>
          <p>수도: <strong>{country.capitalKo}</strong></p>
          <p>{country.factKo}</p>
          {companion && (
            <p className="detail-friend">
              {companion.emoji} 친구: {companion.nameKo}
            </p>
          )}
          <p className="hint">{tier === 'gold' ? '✨ 황금 도장' : '기본 도장 (오늘의 탐험에서 맞히면 황금!)'}</p>
        </>
      ) : (
        <p className="hint">
          🔒 아직 발견하지 못한 나라예요. {country.continent}에 있어요. 탐험에서 맞히면 도장을 받아요!
        </p>
      )}
      <button type="button" className="btn" onClick={onClose}>닫기</button>
    </section>
  );
}
