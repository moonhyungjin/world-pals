import type { ContentStatus } from './country';
import type { CosmeticSlot } from './reward';

/** 캐릭터마다 얼굴 모양이 달라서 장식 그림을 얼마나 옮기고(dx, dy: 캐릭터 그림 200 기준 단위) 키울지(s) 보정한다. */
export type SlotFit = { dx: number; dy: number; s: number };

/** 플레이어가 고르는 주인공 캐릭터. assetKey는 src/assets/characters/<assetKey>.svg 파일 이름이다. */
export type PlayCharacter = {
  id: string;
  nameKo: string;
  descriptionKo: string;
  assetKey: string;
  fit?: Partial<Record<CosmeticSlot, SlotFit>>; // 없으면 보정 없음
  status: ContentStatus;
};
