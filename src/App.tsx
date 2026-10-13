import { lazy, Suspense, useEffect, useState } from 'react';
import { BottomNavigation, type NavTab } from './components/BottomNavigation';
import { content } from './data/content';
import {
  canCreateChallenge,
  challengeCodeFromHash,
  resolveChallenge,
  type Challenge,
  type ChallengeFailure,
} from './features/challenge/challenge';
import { ChallengeIntroPage } from './features/challenge/ChallengeIntroPage';
import { ChallengeMakePage } from './features/challenge/ChallengeMakePage';
import { ChallengeResultExtras, ChallengeUnlockedNotice } from './features/challenge/ChallengeResultExtras';
import { CustomizePage } from './features/customization/CustomizePage';
import { PassportPage } from './features/passport/PassportPage';
import { buildReviewSession, buildSession, type SessionSummary } from './features/quiz/quizEngine';
import { QuizPage } from './features/quiz/QuizPage';
import { completeSession } from './features/rewards/rewardEngine';
import { todayString } from './lib/random';
import { loadProgress, readStoredProgress, saveProgress } from './lib/saveData';
import { STORAGE_KEYS } from './lib/storageKeys';
import { HomePage } from './pages/HomePage';
import { ResultPage } from './pages/ResultPage';
import type { PlayerProgress } from './types/progress';
import type { QuizAnswer, QuizItem } from './types/question';
import type { Badge } from './types/reward';

type Screen =
  | { name: NavTab }
  | { name: 'challengeMake' }
  | { name: 'challengeIntro'; challenge?: Challenge; failure?: ChallengeFailure }
  | { name: 'quiz'; items: QuizItem[]; practice: boolean; challenge?: Challenge }
  | {
      name: 'result';
      summary: SessionSummary;
      wrongCount: number;
      newBadges: Badge[];
      practice: boolean;
      challengeUnlocked: boolean;
      challenge?: { challenge: Challenge; correct: boolean[] };
    };

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

/** 주소가 친구의 도전장(#/c/...)이면 소개 화면을, 잘못된 링크면 안내 화면을 만든다. 도전장 주소가 아니면 null. */
function screenFromHash(): Screen | null {
  const code = challengeCodeFromHash(window.location.hash);
  if (code === null) return null;
  const r = resolveChallenge(code, content, Math.random);
  return r.ok ? { name: 'challengeIntro', challenge: r.challenge } : { name: 'challengeIntro', failure: r.reason };
}

/** 도전장 화면을 떠날 때 주소의 도전장 코드를 지워서, 새로고침해도 다시 열리지 않게 한다. */
function clearChallengeHash() {
  if (window.location.hash.startsWith('#/c/')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function Game({ onOpenLab }: { onOpenLab: () => void }) {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>(() => screenFromHash() ?? { name: 'home' });
  const [saveFailed, setSaveFailed] = useState(false);

  const update = (next: PlayerProgress) => {
    setProgress(next);
    setSaveFailed(!saveProgress(next));
  };

  const goHome = () => {
    clearChallengeHash();
    setScreen({ name: 'home' });
  };
  const start = () => {
    clearChallengeHash();
    setScreen({ name: 'quiz', items: buildSession(content, progress, Math.random), practice: false });
  };
  const startReview = () => {
    const items = buildReviewSession(content, progress, Math.random);
    if (items.length > 0) setScreen({ name: 'quiz', items, practice: true });
  };
  // 도전장은 별 없는 연습 모드로 푼다 (도장과 복습 기록은 반영).
  const startChallenge = (challenge: Challenge) => setScreen({ name: 'quiz', items: challenge.items, practice: true, challenge });

  // 다른 탭/창에서 기록이 바뀌면 이 화면도 최신 기록으로 맞춘다. (같은 탭에서 쓴 변경에는 발생하지 않는다)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.progress || e.key === null) setProgress(loadProgress());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 게임을 켜 둔 채 도전장 링크로 이동했을 때도 소개 화면을 연다.
  useEffect(() => {
    const onHash = () => {
      const s = screenFromHash();
      if (s) setScreen(s);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const finish = (answers: QuizAnswer[], practice: boolean, challenge?: Challenge) => {
    // 퀴즈를 푸는 동안 다른 탭에서 기록이 바뀌었을 수 있으므로, 저장소의 최신 기록 위에 결과를 더한다.
    // (저장소를 읽을 수 없을 때만 화면에 들고 있던 기록을 쓴다.)
    const base = readStoredProgress() ?? progress;
    const result = completeSession(base, answers, todayString(), content, { practice });
    update(result.progress);
    setScreen({
      name: 'result',
      summary: result.summary,
      wrongCount: answers.filter((a) => !a.correct).length,
      newBadges: result.newBadges,
      practice,
      challengeUnlocked: result.challengeUnlocked,
      challenge: challenge ? { challenge, correct: answers.map((a) => a.correct) } : undefined,
    });
  };

  const fullScreen =
    screen.name === 'quiz' || screen.name === 'result' || screen.name === 'challengeIntro' || screen.name === 'challengeMake';
  const openMake = () => {
    clearChallengeHash();
    setScreen({ name: 'challengeMake' });
  };

  return (
    <main className={`app ${fullScreen ? '' : 'with-nav'}`}>
      {saveFailed && (
        <p className="notice" role="alert">
          이 브라우저에서는 기록을 저장할 수 없어요. 창을 닫으면 기록이 사라질 수 있어요.
        </p>
      )}
      {screen.name === 'home' && (
        <HomePage
          progress={progress}
          content={content}
          onStart={start}
          onReview={startReview}
          onMakeChallenge={openMake}
          onOpenLab={LAB_ENABLED ? onOpenLab : undefined}
        />
      )}
      {screen.name === 'passport' && <PassportPage progress={progress} content={content} />}
      {screen.name === 'map' && (
        <Suspense fallback={<Loading />}>
          <MapPage progress={progress} content={content} />
        </Suspense>
      )}
      {screen.name === 'customize' && <CustomizePage progress={progress} content={content} onChange={update} />}
      {screen.name === 'challengeMake' && (
        <ChallengeMakePage progress={progress} content={content} today={todayString()} onBack={goHome} />
      )}
      {screen.name === 'challengeIntro' &&
        (screen.challenge ? (
          <ChallengeIntroPage challenge={screen.challenge} onStart={() => startChallenge(screen.challenge!)} onHome={goHome} />
        ) : (
          <ChallengeIntroPage failure={screen.failure ?? 'format'} onHome={goHome} />
        ))}
      {screen.name === 'quiz' && (
        <QuizPage
          items={screen.items}
          content={content}
          onFinish={(answers) => finish(answers, screen.practice, screen.challenge)}
          onExit={goHome}
        />
      )}
      {screen.name === 'result' && (
        <ResultPage
          summary={screen.summary}
          wrongCount={screen.wrongCount}
          newBadges={screen.newBadges}
          practice={screen.practice}
          content={content}
          onHome={goHome}
          onAgain={screen.challenge ? () => startChallenge(screen.challenge!.challenge) : start}
          title={screen.challenge ? '도전 끝!' : undefined}
          practiceNote={screen.challenge ? '도전장은 별 없이 도장만 받아요! 😊' : undefined}
          againLabel={screen.challenge ? '다시 풀어 보기' : undefined}
        >
          {screen.challenge ? (
            <ChallengeResultExtras
              code={screen.challenge.challenge.code}
              correct={screen.challenge.correct}
              canMake={canCreateChallenge(progress, todayString())}
              onMake={openMake}
            />
          ) : (
            screen.challengeUnlocked && <ChallengeUnlockedNotice onMake={openMake} />
          )}
        </ResultPage>
      )}
      {!fullScreen && <BottomNavigation current={screen.name as NavTab} onChange={(name) => setScreen({ name })} />}
    </main>
  );
}
