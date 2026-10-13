import { useState } from 'react';
import { BottomNavigation, type NavTab } from './components/BottomNavigation';
import { content } from './data/content';
import { CustomizePage } from './features/customization/CustomizePage';
import { PassportPage } from './features/passport/PassportPage';
import { buildReviewSession, buildSession, type SessionSummary } from './features/quiz/quizEngine';
import { QuizPage } from './features/quiz/QuizPage';
import { completeSession } from './features/rewards/rewardEngine';
import { todayString } from './lib/random';
import { loadProgress, saveProgress } from './lib/saveData';
import { HomePage } from './pages/HomePage';
import { ResultPage } from './pages/ResultPage';
import type { PlayerProgress } from './types/progress';
import type { QuizAnswer, QuizItem } from './types/question';
import type { Badge } from './types/reward';

type Screen =
  | { name: NavTab }
  | { name: 'quiz'; items: QuizItem[]; practice: boolean }
  | { name: 'result'; summary: SessionSummary; wrongCount: number; newBadges: Badge[]; practice: boolean };

export function App() {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [saveFailed, setSaveFailed] = useState(false);

  const update = (next: PlayerProgress) => {
    setProgress(next);
    setSaveFailed(!saveProgress(next));
  };

  const start = () => setScreen({ name: 'quiz', items: buildSession(content, progress, Math.random), practice: false });
  const startReview = () => {
    const items = buildReviewSession(content, progress, Math.random);
    if (items.length > 0) setScreen({ name: 'quiz', items, practice: true });
  };

  const finish = (answers: QuizAnswer[], practice: boolean) => {
    const result = completeSession(progress, answers, todayString(), content, { practice });
    update(result.progress);
    setScreen({
      name: 'result',
      summary: result.summary,
      wrongCount: answers.filter((a) => !a.correct).length,
      newBadges: result.newBadges,
      practice,
    });
  };

  const inQuiz = screen.name === 'quiz' || screen.name === 'result';

  return (
    <main className={`app ${inQuiz ? '' : 'with-nav'}`}>
      {saveFailed && (
        <p className="notice" role="alert">
          이 브라우저에서는 기록을 저장할 수 없어요. 창을 닫으면 기록이 사라질 수 있어요.
        </p>
      )}
      {screen.name === 'home' && (
        <HomePage progress={progress} content={content} onStart={start} onReview={startReview} />
      )}
      {screen.name === 'passport' && <PassportPage progress={progress} content={content} />}
      {screen.name === 'customize' && <CustomizePage progress={progress} content={content} onChange={update} />}
      {screen.name === 'quiz' && (
        <QuizPage
          items={screen.items}
          content={content}
          onFinish={(answers) => finish(answers, screen.practice)}
          onExit={() => setScreen({ name: 'home' })}
        />
      )}
      {screen.name === 'result' && (
        <ResultPage
          summary={screen.summary}
          wrongCount={screen.wrongCount}
          newBadges={screen.newBadges}
          practice={screen.practice}
          content={content}
          onHome={() => setScreen({ name: 'home' })}
          onAgain={start}
        />
      )}
      {!inQuiz && <BottomNavigation current={screen.name as NavTab} onChange={(name) => setScreen({ name })} />}
    </main>
  );
}
