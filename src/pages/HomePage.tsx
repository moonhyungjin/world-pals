import { CONFIG } from '../config';
import { Character } from '../components/Character';
import type { Content } from '../data/content';
import { canCreateChallenge } from '../features/challenge/challenge';
import { countReviewable, hasCompletedToday } from '../features/quiz/quizEngine';
import { todayString } from '../lib/random';
import type { PlayerProgress } from '../types/progress';

type Props = {
  progress: PlayerProgress;
  content: Content;
  onStart: () => void;
  onReview: () => void;
  onMakeChallenge: () => void;
  onOpenLab?: () => void;
};

export function HomePage({ progress, content, onStart, onReview, onMakeChallenge, onOpenLab }: Props) {
  const today = todayString();
  const doneToday = hasCompletedToday(progress, today);
  const canChallenge = canCreateChallenge(progress, today);
  const reviewCount = countReviewable(content, progress);
  const equipped = content.cosmetics.filter((c) => progress.equippedCosmeticIds.includes(c.id));
  return (
    <div className="home">
      <h1>World Pals</h1>
      <p className="subtitle">꼬마 세계 탐험대</p>
      <Character size={120} equipped={equipped} />
      <p className="speech">
        {doneToday ? '오늘 탐험은 완료! 한 번 더 연습해 볼까요?' : '오늘은 어디를 탐험할까요?'}
      </p>
      <button type="button" className="btn primary big" onClick={onStart}>
        {doneToday ? '다시 연습하기' : '오늘의 탐험 시작!'}
      </button>
      {reviewCount > 0 && (
        <button type="button" className="btn" onClick={onReview}>
          💪 헷갈린 문제 다시 풀기 ({reviewCount})
        </button>
      )}
      {canChallenge ? (
        <button type="button" className="btn challenge-btn" onClick={onMakeChallenge}>
          💌 친구에게 도전장 보내기
        </button>
      ) : (
        <p className="challenge-lock" role="note">
          💌 도전장은 오늘의 탐험에서 {CONFIG.challengeMinCorrect}문제 이상 맞히면 열려요
          {doneToday ? ' (내일 다시 도전!)' : '!'}
        </p>
      )}
      <ul className="stats card">
        <li><span>⭐</span><strong>{progress.totalStars}</strong><small>별</small></li>
        <li><span>🌍</span><strong>{progress.discoveredCountryIds.length}</strong><small>발견한 나라</small></li>
        <li><span>🏅</span><strong>{progress.collectedBadgeIds.length}</strong><small>배지</small></li>
        <li><span>📅</span><strong>{progress.completedDates.length}</strong><small>탐험한 날</small></li>
      </ul>
      <p className="hint">최고 정답 {progress.bestCorrectCount}개</p>
      {progress.collectedBadgeIds.length > 0 && (
        <ul className="badge-row" aria-label="받은 배지">
          {content.badges
            .filter((b) => progress.collectedBadgeIds.includes(b.id))
            .map((b) => (
              <li key={b.id} title={`${b.nameKo}: ${b.descriptionKo}`}>
                <span aria-hidden="true">{b.emoji}</span> {b.nameKo}
              </li>
            ))}
        </ul>
      )}
      {onOpenLab && (
        <button type="button" className="link lab-entry" onClick={onOpenLab}>🧪 제작자 도구 (Lab)</button>
      )}
    </div>
  );
}
