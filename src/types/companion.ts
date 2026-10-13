import type { ContentStatus } from './country';

/** 나라별 탐험 친구(동물). 그 나라의 도장을 받으면 만나고, 꾸미기에서 한 마리를 데려갈 수 있다. */
export type Companion = {
  id: string;
  countryId: string; // 이 친구를 만나게 되는 나라 (ID로 연결)
  nameKo: string;
  emoji: string; // 이미지 에셋 키로 교체 가능
  descriptionKo: string;
  status: ContentStatus;
  sourceNote?: string;
};
