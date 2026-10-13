import type { Country } from '../types/country';

type Props = { country: Country; className?: string; decorative?: boolean };

/**
 * 국기 SVG 이미지(flag-icons, MIT). 국가 ID(ISO 코드)로 연결하고, 크기는 부모 font-size를 따른다.
 * decorative: 국기 자체가 보기(정답 후보)일 때 나라 이름이 접근성 트리로 새어 나가지 않게 숨긴다.
 */
export function Flag({ country, className = '', decorative = false }: Props) {
  const cls = `fi fi-${country.id.toLowerCase()} flag-img ${className}`;
  if (decorative) return <span className={cls} aria-hidden="true" />;
  return <span className={cls} role="img" aria-label={`${country.nameKo} 국기`} />;
}
