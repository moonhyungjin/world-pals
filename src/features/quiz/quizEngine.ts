import { CONFIG } from '../../config';
import type { Content } from '../../data/content';
import { shuffle, type Rng } from '../../lib/random';
import type { Country } from '../../types/country';
import type { PlayerProgress, StampTier } from '../../types/progress';
import type { QuizAnswer, QuizItem, Question } from '../../types/question';

type Config = typeof CONFIG;

/** 출제 가능한 문제: 문제·정답 국가·오답 국가가 모두 verified이고 보기가 유효한 것만. */
export function eligibleQuestions(content: Content): Question[] {
  const byId = new Map(content.countries.map((c) => [c.id, c]));
  return content.questions.filter((q) => {
    if (q.status !== 'verified') return false;
    const answer = byId.get(q.countryId);
    if (!answer || answer.status !== 'verified') return false;
    const ids = q.distractorCountryIds;
    if (ids.length !== 3 || ids.includes(q.countryId)) return false;
    const seen = new Set([q.type === 'capital' ? answer.capitalKo : answer.id]);
    for (const id of ids) {
      const c = byId.get(id);
      if (!c || c.status !== 'verified') return false;
      const key = q.type === 'capital' ? c.capitalKo : c.id; // 수도 문제는 수도 이름, 국기 문제는 국가 ID 중복 금지
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });
}

/** 오답 복습 + 신규 국가 + 나머지 순으로 세션 문제를 고른다. */
export function selectQuestions(
  content: Content,
  progress: PlayerProgress,
  rng: Rng,
  config: Config = CONFIG,
): Question[] {
  const pool = eligibleQuestions(content);
  const discovered = new Set(progress.discoveredCountryIds);
  const chosen: Question[] = [];
  const take = (list: Question[], limit: number) => {
    for (const q of shuffle(list, rng)) {
      if (chosen.length >= limit) return;
      if (!chosen.includes(q) && !chosen.some((c) => c.countryId === q.countryId)) chosen.push(q);
    }
  };

  const wrong = new Set(progress.wrongQuestionIds);
  take(
    pool.filter((q) => wrong.has(q.id)),
    Math.min(config.maxReviewQuestions, config.sessionSize),
  );

  let fresh = pool.filter((q) => !discovered.has(q.countryId) && !chosen.includes(q));
  if (discovered.size < config.easyOnlyUntilDiscovered) {
    const easy = fresh.filter((q) => q.difficulty === 1);
    fresh = easy.length >= config.sessionSize - chosen.length ? easy : fresh;
  }
  take(fresh, config.sessionSize);
  take(pool, config.sessionSize); // 부족하면 이미 발견한 국가로 채움
  return shuffle(chosen, rng);
}

/** 보기(수도 이름)를 섞어 화면용 문제로 만든다. 표시 문자열이 겹치는 보기는 제외. */
export function buildQuizItem(question: Question, content: Content, rng: Rng): QuizItem {
  const byId = new Map<string, Country>(content.countries.map((c) => [c.id, c]));
  const ids = [question.countryId, ...question.distractorCountryIds];
  const seen = new Set<string>();
  const choices = ids.flatMap((id) => {
    const c = byId.get(id);
    // 보기 글자: 수도 문제는 수도 이름, 국기 문제는 국가 이름(화면에는 정답 확인 후에만 표시)
    const label = question.type === 'capital' ? c?.capitalKo : c?.nameKo;
    if (!c || !label || seen.has(label)) return [];
    seen.add(label);
    return [{ countryId: id, label }];
  });
  return {
    questionId: question.id,
    type: question.type,
    countryId: question.countryId,
    choices: shuffle(choices, rng),
  };
}

export function buildSession(content: Content, progress: PlayerProgress, rng: Rng): QuizItem[] {
  return selectQuestions(content, progress, rng).map((q) => buildQuizItem(q, content, rng));
}

/** 오답 복습 세션: 틀렸던 문제 중 출제 가능한 것만 최대 sessionSize개. */
export function buildReviewSession(
  content: Content,
  progress: PlayerProgress,
  rng: Rng,
  config: Config = CONFIG,
): QuizItem[] {
  const wrong = new Set(progress.wrongQuestionIds);
  const pool = eligibleQuestions(content).filter((q) => wrong.has(q.id));
  return shuffle(pool, rng)
    .slice(0, config.sessionSize)
    .map((q) => buildQuizItem(q, content, rng));
}

export function countReviewable(content: Content, progress: PlayerProgress): number {
  const wrong = new Set(progress.wrongQuestionIds);
  return eligibleQuestions(content).filter((q) => wrong.has(q.id)).length;
}

export type StampResult = { countryId: string; tier: StampTier; kind: 'new' | 'upgrade' };

export type SessionSummary = {
  correctCount: number;
  total: number;
  starsEarned: number;
  stamps: StampResult[]; // 이번 세션에서 새로 얻거나 황금으로 올라간 도장
  rewarded: boolean; // false면 오늘 이미 보상을 받은 연습 모드
};

const dailyEventId = (date: string) => `daily:${date}`;
const stampEventId = (countryId: string, tier: StampTier) => `stamp:${tier}:${countryId}`;

export function hasCompletedToday(progress: PlayerProgress, today: string): boolean {
  return progress.rewardEventIds.includes(dailyEventId(today));
}

function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  const mm = String(prev.getMonth() + 1).padStart(2, '0');
  const dd = String(prev.getDate()).padStart(2, '0');
  return `${prev.getFullYear()}-${mm}-${dd}`;
}

/**
 * 세션 결과를 진행 상황에 반영한다. 순수 함수: 입력을 바꾸지 않는다.
 * - 오답 목록은 항상 갱신(복습은 같은 날에도 가능)
 * - practice 옵션(오답 복습 등)이면 별/일일 보상 없이 기본 도장만 지급
 * - 별과 일일 보상은 보상이 있는 첫 세션에서만, 보상 이벤트 ID로 한 번만 지급
 * - 국가 도장은 연습에서도 지급: 연습=기본 도장, 보상 세션=황금 도장(기본 → 황금 업그레이드 가능)
 */
export function applySession(
  progress: PlayerProgress,
  answers: QuizAnswer[],
  today: string,
  options: { practice?: boolean } = {},
  config: Config = CONFIG,
): { progress: PlayerProgress; summary: SessionSummary } {
  const next: PlayerProgress = structuredClone(progress);
  const events = new Set(next.rewardEventIds);
  const wrong = new Set(next.wrongQuestionIds);
  const correctCount = answers.filter((a) => a.correct).length;
  const rewarded = !options.practice && answers.length > 0 && !events.has(dailyEventId(today));
  const wasWrong = new Set(progress.wrongQuestionIds);
  next.reviewCorrectCount += answers.filter((a) => a.correct && wasWrong.has(a.questionId)).length;

  for (const a of answers) {
    if (a.correct) wrong.delete(a.questionId);
    else wrong.add(a.questionId);
  }

  const stampTier: StampTier = rewarded ? 'gold' : 'basic';
  const stamps: StampResult[] = [];
  for (const a of answers) {
    if (!a.correct || stamps.some((s) => s.countryId === a.countryId)) continue;
    const current = next.stampTiers[a.countryId];
    if (current === 'gold' || current === stampTier) continue;
    const kind = current ? 'upgrade' : 'new';
    next.stampTiers[a.countryId] = stampTier;
    events.add(stampEventId(a.countryId, stampTier));
    if (!next.discoveredCountryIds.includes(a.countryId)) next.discoveredCountryIds.push(a.countryId);
    stamps.push({ countryId: a.countryId, tier: stampTier, kind });
  }

  let starsEarned = 0;
  if (rewarded) {
    starsEarned = correctCount * config.starsPerCorrect + config.starsDailyCompletion;
    events.add(dailyEventId(today));
    next.currentStreak = next.completedDates.includes(previousDay(today)) ? next.currentStreak + 1 : 1;
    if (!next.completedDates.includes(today)) next.completedDates.push(today);
    next.totalStars += starsEarned;
  }

  next.totalAnswered += answers.length;
  next.bestCorrectCount = Math.max(next.bestCorrectCount, correctCount);
  next.wrongQuestionIds = [...wrong];
  next.rewardEventIds = [...events];

  return {
    progress: next,
    summary: { correctCount, total: answers.length, starsEarned, stamps, rewarded },
  };
}
