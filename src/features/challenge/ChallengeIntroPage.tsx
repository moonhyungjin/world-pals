import { Character } from '../../components/Character';
import { CHALLENGE_MESSAGES, type Challenge, type ChallengeFailure } from './challenge';

const FAILURE_TEXT: Record<ChallengeFailure, string> = {
  empty: '도전장 링크가 비어 있어요.',
  format: '도전장 링크가 올바르지 않아요. 링크가 중간에 잘렸을 수 있어요.',
  'too-many': '도전장 링크가 올바르지 않아요.',
  duplicate: '도전장 링크가 올바르지 않아요.',
  unknown: '이 도전장의 문제를 찾을 수 없어요. 앱이 업데이트됐거나 링크가 틀렸을 수 있어요.',
};

type Props =
  | { challenge: Challenge; failure?: undefined; onStart: () => void; onHome: () => void }
  | { challenge?: undefined; failure: ChallengeFailure; onStart?: undefined; onHome: () => void };

/** 친구가 보낸 도전장을 열었을 때의 첫 화면. 잘못된 링크도 여기서 부드럽게 안내한다. */
export function ChallengeIntroPage(props: Props) {
  if (!props.challenge) {
    return (
      <div className="challenge intro">
        <Character mood="think" size={110} />
        <h1>도전장을 열 수 없어요</h1>
        <p className="speech">{FAILURE_TEXT[props.failure]}</p>
        <p className="hint">보낸 친구에게 링크를 다시 받아 볼래요?</p>
        <button type="button" className="btn primary big" onClick={props.onHome}>홈으로</button>
      </div>
    );
  }
  const { items, message } = props.challenge;
  const capitals = items.filter((i) => i.type === 'capital').length;
  const flags = items.length - capitals;
  return (
    <div className="challenge intro">
      <Character mood="cheer" size={120} />
      <h1>💌 도전장이 왔어요!</h1>
      {message !== null && <p className="bubble">“{CHALLENGE_MESSAGES[message]}”</p>}
      <section className="card">
        <p className="score">
          <strong>{items.length}문제</strong>
        </p>
        <p className="hint">
          {capitals > 0 && `🏛️ 수도 ${capitals}개`}
          {capitals > 0 && flags > 0 && ' · '}
          {flags > 0 && `🚩 국기 ${flags}개`}
        </p>
        <p className="hint">별은 없지만 맞히면 나라 도장을 받아요!</p>
      </section>
      <button type="button" className="btn primary big" onClick={props.onStart}>도전 시작!</button>
      <button type="button" className="btn" onClick={props.onHome}>나중에 할래요</button>
    </div>
  );
}
