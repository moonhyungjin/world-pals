/**
 * 장식 그림(SVG) 주소 목록. assetKey로 찾는다.
 * 그림은 캐릭터 그림(200x200)과 같은 좌표계로, 사방에 60씩 여백을 둔 viewBox(-60 -60 320 320)에 그려서
 * 캐릭터 위에 그대로 겹치면 정확한 자리에 놓인다. (배낭처럼 몸 밖으로 나오는 것도 여백 안에 그린다.)
 */
const PREFIX = '../../assets/cosmetics/';
const URLS = import.meta.glob<string>('../../assets/cosmetics/*.svg', { eager: true, query: '?url', import: 'default' });

export const cosmeticImageUrl = (assetKey: string | undefined): string | undefined => (assetKey ? URLS[`${PREFIX}${assetKey}.svg`] : undefined);

/** Lab이 고를 수 있는 그림 파일 이름들 */
export const COSMETIC_ASSET_KEYS: string[] = Object.keys(URLS)
  .map((p) => p.slice(PREFIX.length, -'.svg'.length))
  .sort();

/** 캐릭터 그림 대비 장식 그림 상자의 크기(%)와 시작 위치(%): 320/200 = 160%, 여백 60/200 = 30% */
export const COSMETIC_BOX = { size: 160, offset: -30 } as const;
