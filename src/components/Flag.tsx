import type { Country } from '../types/country';

/**
 * 국기 SVG(flag-icons, MIT)의 파일 주소 목록. 이미지는 CSS에 넣지 않고 화면에 나온 국기만 개별로 내려받는다.
 * (vite.config.ts의 assetsInlineLimit: 0 덕분에 SVG가 JS/CSS에 인라인되지 않고 파일로 분리된다.)
 */
const FLAG_URLS = import.meta.glob<string>('../../node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const flagUrl = (id: string): string | undefined =>
  FLAG_URLS[`../../node_modules/flag-icons/flags/4x3/${id.toLowerCase()}.svg`];

type Props = { country: Country; className?: string; decorative?: boolean };

/**
 * 국기 이미지. 국가 ID(ISO 코드)로 연결하고, 크기는 부모 font-size를 따른다.
 * decorative: 국기 자체가 보기(정답 후보)일 때 나라 이름이 접근성 트리로 새어 나가지 않게 숨긴다.
 */
export function Flag({ country, className = '', decorative = false }: Props) {
  const url = flagUrl(country.id);
  // 국기 파일이 없는 ID(예: Lab에서 만든 임시 국가)는 흰 깃발로 대신 보여준다.
  const cls = `fi fi-${country.id.toLowerCase()} flag-img ${url ? '' : 'flag-missing'} ${className}`;
  const style = url ? { backgroundImage: `url("${url}")` } : undefined;
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': `${country.nameKo} 국기` } as const);
  return <span className={cls} style={style} {...a11y} />;
}
