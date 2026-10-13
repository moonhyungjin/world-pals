import { useState } from 'react';
import type { Content } from '../../data/content';
import { buildQuizItem, type SessionSummary } from '../quiz/quizEngine';
import { QuizPage } from '../quiz/QuizPage';
import { completeSession } from '../rewards/rewardEngine';
import { todayString } from '../../lib/random';
import { defaultProgress, loadProgress, saveProgress } from '../../lib/saveData';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { ResultPage } from '../../pages/ResultPage';
import type { PlayerProgress } from '../../types/progress';
import type { QuizAnswer, QuizItem } from '../../types/question';
import type { Badge } from '../../types/reward';

type Phase =
  | { name: 'pick' }
  | { name: 'play'; items: QuizItem[]; ids: string[] }
  | { name: 'result'; summary: SessionSummary; wrongCount: number; newBadges: Badge[]; ids: string[] };

/**
 * 플레이 테스트실. 선택한 문제를 실제 게임과 같은 코드로 플레이한다.
 * 진행 기록은 테스트 전용 저장 키(labTestProgress)에만 쓰고, 실제 플레이 기록은 건드리지 않는다.
 */
export function PlaytestPanel({ content }: { content: Content }) {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress(STORAGE_KEYS.labTestProgress));
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [message, setMessage] = useState('');

  const playable = content.questions.filter((q) => content.countries.some((c) => c.id === q.countryId));
  const countryName = (id: string) => content.countries.find((c) => c.id === id)?.nameKo || id;

  const store = (next: PlayerProgress) => {
    setProgress(next);
    if (!saveProgress(next, STORAGE_KEYS.labTestProgress)) setMessage('⚠️ 테스트 기록을 저장하지 못했어요.');
  };

  const start = (ids: string[]) => {
    const items = ids
      .map((id) => content.questions.find((q) => q.id === id))
      .flatMap((q) => (q ? [buildQuizItem(q, content, Math.random)] : []))
      .filter((it) => it.choices.length >= 2);
    if (items.length === 0) {
      setMessage('플레이할 수 있는 문제가 없어요. 문제와 국가 설정을 확인해 주세요.');
      return;
    }
    setMessage('');
    setPhase({ name: 'play', items, ids });
  };

  const finish = (answers: QuizAnswer[], ids: string[]) => {
    const r = completeSession(progress, answers, todayString(), content);
    store(r.progress);
    setPhase({ name: 'result', summary: r.summary, wrongCount: answers.filter((a) => !a.correct).length, newBadges: r.newBadges, ids });
  };

  if (phase.name === 'play') {
    return (
      <div className="lab-play">
        <p className="lab-note">🧪 테스트 플레이 중이에요. 실제 플레이 기록에는 반영되지 않아요.</p>
        <QuizPage items={phase.items} content={content} onFinish={(a) => finish(a, phase.ids)} onExit={() => setPhase({ name: 'pick' })} />
      </div>
    );
  }
  if (phase.name === 'result') {
    return (
      <div className="lab-play">
        <p className="lab-note">🧪 테스트 결과예요. 실제 플레이 기록에는 반영되지 않아요.</p>
        <ResultPage
          summary={phase.summary}
          wrongCount={phase.wrongCount}
          newBadges={phase.newBadges}
          practice={false}
          content={content}
          onHome={() => setPhase({ name: 'pick' })}
          onAgain={() => start(phase.ids)}
        />
        <p className="hint">'홈으로'를 누르면 편집 화면의 플레이 테스트로 돌아가요.</p>
      </div>
    );
  }

  const allSelected = playable.length > 0 && selected.length === playable.length;
  return (
    <div className="lab-playtest">
      <section className="lab-card">
        <h3>테스트 기록 (실제 기록과 별도 저장)</h3>
        <p>
          ⭐ {progress.totalStars} · 🌍 도장 {progress.discoveredCountryIds.length}개 · 🏅 배지 {progress.collectedBadgeIds.length}개 · 오답 {progress.wrongQuestionIds.length}개
        </p>
        <div className="lab-actions">
          <button type="button" className="lab-btn" onClick={() => store({ ...progress, totalStars: progress.totalStars + 10 })}>테스트 별 +10</button>
          <button type="button" className="lab-btn danger" onClick={() => { store(defaultProgress()); setMessage('테스트 기록을 초기화했어요.'); }}>
            테스트 기록 초기화
          </button>
        </div>
        <p className="lab-note">'오늘의 탐험' 보상은 하루 한 번만 지급돼요. 반복해서 보려면 테스트 기록을 초기화하세요.</p>
        {message && <p className="lab-note" role="status">{message}</p>}
      </section>

      <section className="lab-card">
        <h3>플레이할 문제 고르기</h3>
        <p className="lab-note">초안/검수 중 문제도 여기서는 플레이할 수 있어요 (실제 게임에서는 제외돼요).</p>
        <div className="lab-actions">
          <button type="button" className="lab-btn" onClick={() => setSelected(allSelected ? [] : playable.map((q) => q.id))}>{allSelected ? '모두 해제' : '모두 선택'}</button>
          <button type="button" className="lab-btn primary" disabled={selected.length === 0} onClick={() => start(selected)}>선택한 문제 {selected.length}개 플레이</button>
        </div>
        <ul className="lab-checklist">
          {playable.map((q) => (
            <li key={q.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, q.id] : s.filter((x) => x !== q.id)))}
                />
                {countryName(q.countryId)} · {q.type === 'capital' ? '수도' : '국기'} <small>({q.id} · {q.status})</small>
              </label>
              <button type="button" className="lab-btn" onClick={() => start([q.id])}>이 문제만</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
