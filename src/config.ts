/** 출제 정책과 보상 수치. 게임 로직에 숫자를 흩어 놓지 않는다. */
export const CONFIG = {
  sessionSize: 5,
  maxReviewQuestions: 2, // 세션당 오답 복습 문제 최대 개수
  easyOnlyUntilDiscovered: 5, // 발견 국가가 이 수 미만이면 쉬운 문제 위주
  starsPerCorrect: 1,
  starsDailyCompletion: 3,
  progressVersion: 1,
  // 도전장(친구에게 문제 내기)
  challengeMinCorrect: 4, // 오늘의 탐험에서 이만큼 맞히면 그날 도전장을 만들 수 있다
  challengeMinQuestions: 3,
  challengeMaxQuestions: 5,
} as const;
