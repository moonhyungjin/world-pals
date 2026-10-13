import { lazy, Suspense, useEffect, useState } from 'react';
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

// 제작 도구와 세계지도(큰 지도 데이터)는 필요할 때만 내려받는다.
const LabLayout = lazy(() => import('./features/lab/LabLayout').then((m) => ({ default: m.LabLayout })));
const MapPage = lazy(() => import('./features/map/MapPage').then((m) => ({ default: m.MapPage })));
const Loading = () => <p className="hint" role="status">불러오는 중이에요…</p>;

/**
 * Lab은 개발 중(npm run dev)에는 항상 열리고, 배포 빌드에서는 VITE_ENABLE_LAB=true일 때만 열린다.
 * 기본값(꺼짐)이면 #/lab 주소와 홈의 링크가 모두 사라져 어린이용 배포본에 제작 도구가 노출되지 않는다.
 */
export const LAB_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LAB === 'true';

/** 제작자용 Lab은 별도 주소(#/lab)로 분리한다. 플레이어 화면에서는 작은 링크로만 연결한다. */
function useIsLab(): [boolean, (on: boolean) => void] {
  const read = () => LAB_ENABLED && window.location.hash === '#/lab';
  const [isLab, setIsLab] = useState(read);
  useEffect(() => {
    const onHash = () => setIsLab(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [
    isLab,
    (on) => {
      window.location.hash = on ? '#/lab' : '';
    },
  ];
}

export function App() {
  const [isLab, setLab] = useIsLab();
  return isLab ? (
    <Suspense fallback={<Loading />}>
      <LabLayout onExit={() => setLab(false)} />
    </Suspense>
  ) : (
    <Game onOpenLab={() => setLab(true)} />
  );
}

function Game({ onOpenLab }: { onOpenLab: () => void }) {
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
        <HomePage progress={progress} content={content} onStart={start} onReview={startReview} onOpenLab={LAB_ENABLED ? onOpenLab : undefined} />
      )}
      {screen.name === 'passport' && <PassportPage progress={progress} content={content} />}
      {screen.name === 'map' && (
        <Suspense fallback={<Loading />}>
          <MapPage progress={progress} content={content} />
        </Suspense>
      )}
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
