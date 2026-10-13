/**
 * 캐릭터 그림(SVG) 주소 목록. assetKey로 찾는다.
 * (vite.config.ts의 assetsInlineLimit: 0 덕분에 파일로 분리되어 화면에 나온 캐릭터만 내려받는다.)
 */
const PREFIX = '../../assets/characters/';
const URLS = import.meta.glob<string>('../../assets/characters/*.svg', { eager: true, query: '?url', import: 'default' });

export const characterImageUrl = (assetKey: string): string | undefined => URLS[`${PREFIX}${assetKey}.svg`];

/** Lab이 고를 수 있는 그림 파일 이름들 */
export const CHARACTER_ASSET_KEYS: string[] = Object.keys(URLS)
  .map((p) => p.slice(PREFIX.length, -'.svg'.length))
  .sort();
