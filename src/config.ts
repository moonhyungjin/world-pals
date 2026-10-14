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
  challengeStarsPerCorrect: 1, // 친구의 도전장을 처음 풀 때 맞힌 문제 하나당 보너스 별
  challengeBonusDailyMax: 6, // 하루에 도전장으로 받을 수 있는 보너스 별 상한 (푸는 사람)
  challengeCreateBonusStars: 2, // 도전장을 만든 사람이 하루에 한 번 받는 보너스 별
  // 친구가 푼 결과(확인코드)를 붙여 넣은 만든 사람의 보상
  friendResultStars: 1, // 친구 한 명이 풀 때마다
  friendResultPerfectBonus: 1, // 친구가 만점이면 추가
  friendResultsPerChallenge: 3, // 도전장 하나에서 보상을 받을 수 있는 친구 수
  friendBonusDailyMax: 6, // 하루에 친구 결과로 받을 수 있는 별 상한
} as const;
