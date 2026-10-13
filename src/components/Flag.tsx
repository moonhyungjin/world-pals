import type { Country } from '../types/country';

/** 국기 SVG 이미지(flag-icons, MIT). 국가 ID(ISO 코드)로 연결하고, 크기는 부모 font-size를 따른다. */
export function Flag({ country, className = '' }: { country: Country; className?: string }) {
  return <span className={`fi fi-${country.id.toLowerCase()} flag-img ${className}`} role="img" aria-label={`${country.nameKo} 국기`} />;
}
