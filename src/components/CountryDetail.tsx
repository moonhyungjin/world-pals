import type { Country } from '../types/country';
import type { StampTier } from '../types/progress';
import { Flag } from './Flag';

/** 여권/지도에서 국가를 눌렀을 때 보여주는 상세 카드. 발견 전에는 수도를 알려주지 않는다. */
export function CountryDetail({ country, tier, onClose }: { country: Country; tier?: StampTier; onClose: () => void }) {
  return (
    <section className="card detail" role="status">
      <Flag country={country} className="big-flag" />
      <h2>{country.nameKo}</h2>
      {tier ? (
        <>
          <p>수도: <strong>{country.capitalKo}</strong></p>
          <p>{country.factKo}</p>
          <p className="hint">{tier === 'gold' ? '✨ 황금 도장' : '기본 도장 (오늘의 탐험에서 맞히면 황금!)'}</p>
        </>
      ) : (
        <p className="hint">🔒 아직 발견하지 못했어요. 탐험에서 수도를 맞히면 도장을 받아요!</p>
      )}
      <button type="button" className="btn" onClick={onClose}>닫기</button>
    </section>
  );
}
