import { useState } from 'react';
import { CONFIG } from '../../config';
import { copyText } from '../../lib/share';
import { challengeUrl, resultMarks, resultShareText } from './challenge';

/** 도전장을 푼 뒤 결과 화면에 붙는 영역: ⭕❌ 결과, 결과 보내기, 나도 도전장 만들기. */
export function ChallengeResultExtras({
  code,
  resultCode,
  correct,
  canMake,
  onMake,
}: {
  code: string;
  resultCode?: string;
  correct: boolean[];
  canMake: boolean;
  onMake: () => void;
}) {
  const [status, setStatus] = useState('');
  const copy = async () => {
    const ok = await copyText(resultShareText(correct, challengeUrl(code), resultCode));
    setStatus(ok ? '📋 복사했어요! 친구에게 붙여넣어 보내요.' : '복사하지 못했어요.');
  };
  return (
    <section className="card share-result">
      <p className="marks" aria-label={`결과 ${correct.filter(Boolean).length}개 정답, ${correct.length}문제 중`}>
        {resultMarks(correct)}
      </p>
      <button type="button" className="btn" onClick={copy}>📋 결과 친구에게 보내기</button>
      {status && <p role="status">{status}</p>}
      {canMake ? (
        <button type="button" className="btn challenge-btn" onClick={onMake}>💌 나도 도전장 만들기</button>
      ) : (
        <p className="hint">오늘의 탐험에서 {CONFIG.challengeMinCorrect}문제 이상 맞히면 나도 도전장을 만들 수 있어요!</p>
      )}
    </section>
  );
}

/** 오늘의 탐험을 잘 풀어서 도전장 만들기가 열렸을 때 결과 화면에 보여주는 알림. */
export function ChallengeUnlockedNotice({ onMake }: { onMake: () => void }) {
  return (
    <section className="card share-result" role="status">
      <p className="reward-line">💌 도전장 보내기가 열렸어요!</p>
      <p className="hint">오늘 잘 풀어서 친구에게 문제를 낼 수 있어요.</p>
      <button type="button" className="btn challenge-btn" onClick={onMake}>친구에게 도전장 보내기</button>
    </section>
  );
}
