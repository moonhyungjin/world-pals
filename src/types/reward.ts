import type { ContentStatus } from './country';

export type CosmeticSlot = 'head' | 'face' | 'neck' | 'back';

/** 별로 해금하는 캐릭터 장식. 슬롯마다 하나만 장착할 수 있다. */
export type Cosmetic = {
  id: string;
  nameKo: string;
  descriptionKo: string;
  slot: CosmeticSlot;
  emoji: string; // 이미지 에셋 키로 교체 가능
  cost: number;
  status: ContentStatus;
};

/** 데이터로 정의하는 배지 조건. 첫 버전은 아래 종류만 지원한다. */
export type BadgeCondition =
  | { type: 'sessionsCompleted'; count: number }
  | { type: 'countriesDiscovered'; count: number }
  | { type: 'continentDiscovered'; continent: string; count: number }
  | { type: 'questionsAnswered'; count: number }
  | { type: 'reviewCorrect'; count: number };

export type Badge = {
  id: string;
  nameKo: string;
  descriptionKo: string;
  emoji: string;
  condition: BadgeCondition;
  status: ContentStatus;
};
