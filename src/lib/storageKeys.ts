export const STORAGE_KEYS = {
  progress: 'worldpals.progress',
  // Lab 플레이 테스트용. 실제 진행 기록과 분리한다.
  labTestProgress: 'worldpals.lab.test.progress',
  // Lab 편집 중인 콘텐츠 초안과 버전 사본 (플레이어 진행 기록과 완전히 분리)
  labDraft: 'worldpals.lab.draft',
  labSnapshots: 'worldpals.lab.snapshots',
} as const;
