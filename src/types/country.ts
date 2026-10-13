export type ContentStatus = 'draft' | 'review' | 'verified';

export type Country = {
  id: string; // 안정적인 고유 ID (ISO 3166-1 alpha-2)
  nameKo: string;
  capitalKo: string;
  continent: string;
  flag: string; // 이모지 또는 이미지 리소스 키
  latitude?: number;
  longitude?: number;
  factKo: string;
  aliases?: string[];
  status: ContentStatus;
  sourceNote?: string;
};
