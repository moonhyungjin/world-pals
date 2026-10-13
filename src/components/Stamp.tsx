import type { Country } from '../types/country';
import type { StampTier } from '../types/progress';
import { Flag } from './Flag';

const TIER_LABEL: Record<StampTier, string> = { basic: '기본 도장', gold: '황금 도장' };

/** 여권 도장. 등급은 색·광택과 글자로 함께 구분한다. */
export function Stamp({ country, tier }: { country: Country; tier: StampTier }) {
  return (
    <div className={`stamp stamp-${tier}`} role="img" aria-label={`${country.nameKo} ${TIER_LABEL[tier]}`}>
      <span className="stamp-flag" aria-hidden="true"><Flag country={country} /></span>
      <span className="stamp-name">{country.nameKo}</span>
      <span className="stamp-tier" aria-hidden="true">{tier === 'gold' ? '✨ 황금' : '기본'}</span>
    </div>
  );
}
