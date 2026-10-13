import type { ContentStatus } from './country';

/** 플레이어가 고르는 주인공 캐릭터. assetKey는 src/assets/characters/<assetKey>.svg 파일 이름이다. */
export type PlayCharacter = {
  id: string;
  nameKo: string;
  descriptionKo: string;
  assetKey: string;
  status: ContentStatus;
};
