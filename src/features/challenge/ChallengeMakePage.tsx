import { useMemo, useState } from 'react';
import { Character } from '../../components/Character';
import { Flag } from '../../components/Flag';
import { CONFIG } from '../../config';
import type { Content } from '../../data/content';
import { copyText, shareOrCopy } from '../../lib/share';
import type { PlayerProgress } from '../../types/progress';
import type { QuestionType } from '../../types/question';
import {
  CHALLENGE_MESSAGES,
  availableTypes,
  canCreateChallenge,
  challengeUrl,
  encodeChallenge,
  limits,
  type ChallengeEntry,
} from './challenge';

const TYPE_LABEL: Record<QuestionType, string> = { capital: '수도', flag: '국기' };

type Props = {
  progress: PlayerProgress;
  content: Content;
  today: string;
  onBack: () => void;
  onCreated: (code: string) => void; // 링크를 만들었을 때 (내가 만든 도전장으로 기록하기 위해)
};

/** 도전장 만들기: 내가 도장을 받은 나라 중에서 고르고, 링크를 만들어 친구에게 보낸다. */
export function ChallengeMakePage({ progress, content, today, onBack, onCreated }: Props) {
  const [picks, setPicks] = useState<ChallengeEntry[]>([]);
  const [message, setMessage] = useState<number>(0);
  const [created, setCreated] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  // 도장을 받은 나라 중, 문제로 낼 수 있는 나라만
  const candidates = useMemo(
    () =>
      content.countries.filter(
        (c) => progress.discoveredCountryIds.includes(c.id) && availableTypes(content, c.id).length > 0,
      ),
    [content, progress.discoveredCountryIds],
  );

  if (!canCreateChallenge(progress, today)) {
    return (
      <div className="challenge">
        <Character mood="think" size={96} />
        <h1>💌 도전장 보내기</h1>
        <p className="speech">오늘의 탐험에서 {CONFIG.challengeMinCorrect}문제 이상 맞히면 열려요!</p>
        <button type="button" className="btn primary" onClick={onBack}>돌아가기</button>
      </div>
    );
  }

  // 빠르게 연속으로 눌러도 직전 선택이 사라지지 않도록, 항상 최신 상태 위에서 바꾼다.
  const change = (update: (prev: ChallengeEntry[]) => ChallengeEntry[]) => {
    setPicks(update);
    setCreated(null); // 고치면 링크를 다시 만들게 한다
    setStatus('');
  };
  const isPicked = (id: string) => picks.some((p) => p.countryId === id);
  const toggle = (countryId: string) =>
    change((prev) => {
      if (prev.some((p) => p.countryId === countryId)) return prev.filter((p) => p.countryId !== countryId);
      if (prev.length >= limits.max) return prev;
      return [...prev, { countryId, type: availableTypes(content, countryId)[0] }];
    });
  const setType = (countryId: string, type: QuestionType) =>
    change((prev) => prev.map((p) => (p.countryId === countryId ? { ...p, type } : p)));

  const ready = picks.length >= limits.min && picks.length <= limits.max;
  const url = created ? challengeUrl(created) : '';
  const nameOf = (id: string) => content.countries.find((c) => c.id === id);

  const copy = async () => setStatus((await copyText(url)) ? '📋 복사했어요! 친구에게 붙여넣어 보내요.' : '복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.');
  const share = async () => {
    const r = await shareOrCopy({
      title: 'World Pals 도전장',
      text: `${CHALLENGE_MESSAGES[message]} World Pals 도전장이 도착했어요!`,
      url,
    });
    if (r === 'copied') setStatus('📋 링크를 복사했어요! 친구에게 붙여넣어 보내요.');
    else if (r === 'shared') setStatus('💌 보냈어요!');
    else if (r === 'failed') setStatus('보내지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.');
  };

  return (
    <div className="challenge">
      <header className="quiz-header">
        <button type="button" className="link" onClick={onBack}>← 돌아가기</button>
      </header>
      <Character mood="cheer" size={84} />
      <h1>💌 도전장 만들기</h1>
      <p className="speech">내가 아는 나라로 친구에게 문제를 내요!</p>

      <section className="card" aria-labelledby="pick-title">
        <h2 id="pick-title" className="section-title">1. 나라를 골라요 ({picks.length}/{limits.max})</h2>
        <p className="hint">도장을 받은 나라만 낼 수 있어요. {limits.min}개 이상 골라요.</p>
        <ul className="pick-grid">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`pick-cell ${isPicked(c.id) ? 'on' : ''}`}
                aria-pressed={isPicked(c.id)}
                disabled={!isPicked(c.id) && picks.length >= limits.max}
                onClick={() => toggle(c.id)}
              >
                <Flag country={c} lazy decorative />
                <span>{c.nameKo}</span>
                {isPicked(c.id) && <span className="pick-check" aria-hidden="true">✅</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {picks.length > 0 && (
        <section className="card" aria-labelledby="type-title">
          <h2 id="type-title" className="section-title">2. 어떤 문제로 낼까요?</h2>
          <ul className="type-list">
            {picks.map((p) => {
              const country = nameOf(p.countryId);
              const types = availableTypes(content, p.countryId);
              return (
                <li key={p.countryId}>
                  <span className="type-name">{country?.nameKo}</span>
                  <span className="type-toggle" role="group" aria-label={`${country?.nameKo} 문제 유형`}>
                    {types.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`chip ${p.type === t ? 'active' : ''}`}
                        aria-pressed={p.type === t}
                        onClick={() => setType(p.countryId, t)}
                      >
                        {t === 'capital' ? '🏛️ ' : '🚩 '}
                        {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="msg-title">
        <h2 id="msg-title" className="section-title">3. 한마디를 골라요</h2>
        <div className="msg-list" role="radiogroup" aria-label="한마디">
          {CHALLENGE_MESSAGES.map((m, i) => (
            <label key={m} className={`msg-option ${message === i ? 'on' : ''}`}>
              <input
                type="radio"
                name="challenge-message"
                checked={message === i}
                onChange={() => {
                  setMessage(i);
                  setCreated(null);
                }}
              />
              {m}
            </label>
          ))}
        </div>
      </section>

      <button
        type="button"
        className="btn primary big"
        disabled={!ready}
        onClick={() => {
          const code = encodeChallenge(picks, message);
          setCreated(code);
          onCreated(code);
        }}
      >
        {ready ? '💌 도전장 만들기' : `나라를 ${limits.min}개 이상 골라요`}
      </button>

      {created && (
        <section className="card link-card" aria-live="polite">
          <p className="reward-line">🎉 도전장이 완성됐어요!</p>
          <input className="link-input" readOnly value={url} aria-label="도전장 링크" onFocus={(e) => e.currentTarget.select()} />
          <div className="link-actions">
            <button type="button" className="btn primary" onClick={share}>📤 보내기</button>
            <button type="button" className="btn" onClick={copy}>📋 링크 복사</button>
          </div>
          {status && <p role="status">{status}</p>}
          <p className="hint">🔒 링크에는 이름이나 개인 정보가 없어요. 그래도 아는 사람에게만 보내요.</p>
        </section>
      )}
    </div>
  );
}
