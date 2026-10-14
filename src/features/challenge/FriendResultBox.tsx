import { useState } from 'react';
import { claimMessage, type ClaimOutcome } from './friendResult';

/** 내가 만든 도전장을 푼 친구의 결과를 붙여 넣고 별을 받는 상자. */
export function FriendResultBox({ onClaim }: { onClaim: (text: string) => ClaimOutcome }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ tone: 'good' | 'info'; text: string } | null>(null);
  const submit = () => {
    const outcome = onClaim(text);
    setMessage(claimMessage(outcome));
    if (outcome.stars > 0) setText('');
  };
  return (
    <details className="card friend-box">
      <summary>🎁 친구가 푼 결과 확인하기</summary>
      <p className="hint">친구가 보낸 결과 글을 붙여 넣으면 별을 받아요!</p>
      <textarea aria-label="친구가 보낸 결과" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="여기에 붙여 넣어요" />
      <button type="button" className="btn" onClick={submit} disabled={!text.trim()}>별 받기</button>
      {message && <p role="status" className={message.tone}>{message.text}</p>}
    </details>
  );
}
