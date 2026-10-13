import type { ReactNode } from 'react';
import { Character } from '../components/Character';
import { Stamp } from '../components/Stamp';
import type { Content } from '../data/content';
import type { SessionSummary } from '../features/quiz/quizEngine';
import type { Badge } from '../types/reward';

type Props = {
  summary: SessionSummary;
  wrongCount: number;
  newBadges: Badge[];
  practice: boolean;
  content: Content;
  onHome: () => void;
  onAgain: () => void;
  /** 도전장 풀이 등 다른 화면에서 문구/버튼을 바꿔 쓰기 위한 옵션 */
  title?: string;
  practiceNote?: string;
  againLabel?: string;
  children?: ReactNode; // 점수 아래에 끼워 넣는 추가 영역(도전장 결과 공유 등)
};

export function ResultPage({
  summary,
  wrongCount,
  newBadges,
  practice,
  content,
  onHome,
  onAgain,
  title = '탐험 끝!',
  practiceNote,
  againLabel = '한 번 더 연습하기',
  children,
}: Props) {
  const stamps = summary.stamps.flatMap((s) => {
    const country = content.countries.find((c) => c.id === s.countryId);
    return country ? [{ ...s, country }] : [];
  });
  const hasBasic = stamps.some((s) => s.tier === 'basic');

  return (
    <div className="result">
      <Character mood="cheer" size={110} />
      <h1>{title}</h1>
      <p className="score">
        {summary.total}문제 중 <strong>{summary.correctCount}문제</strong>를 맞혔어요
      </p>

      <section className="card">
        {summary.rewarded ? (
          <p className="reward-line">⭐ 별 {summary.starsEarned}개를 얻었어요!</p>
        ) : (
          <p>
            {practice
              ? (practiceNote ?? '복습은 별 없이 도장만 받아요. 오늘의 탐험에서 별을 모아요! 😊')
              : '오늘의 별은 이미 받았어요. 연습도 도장은 받을 수 있어요! 😊'}
          </p>
        )}
        {stamps.length > 0 && (
          <div>
            <p>🌍 도장을 받았어요</p>
            <ul className="stamps">
              {stamps.map((s) => (
                <li key={s.countryId}>
                  <Stamp country={s.country} tier={s.tier} />
                  <small>{s.kind === 'upgrade' ? '황금 도장으로 업그레이드!' : '새로 발견!'}</small>
                </li>
              ))}
            </ul>
            {hasBasic && <p className="hint">다음 오늘의 탐험에서 맞히면 황금 도장이 돼요!</p>}
          </div>
        )}
      </section>

      {newBadges.length > 0 && (
        <section className="card">
          <p>🏅 새 배지를 받았어요!</p>
          <ul className="badge-row">
            {newBadges.map((b) => (
              <li key={b.id}>
                <span aria-hidden="true">{b.emoji}</span> <strong>{b.nameKo}</strong>
                <small> — {b.descriptionKo}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children}

      {wrongCount > 0 && <p className="hint">헷갈린 문제 {wrongCount}개는 다음 탐험에서 다시 만나요.</p>}

      <button type="button" className="btn primary big" onClick={onHome}>홈으로</button>
      <button type="button" className="btn" onClick={onAgain}>{againLabel}</button>
    </div>
  );
}
