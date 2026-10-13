import { useState } from 'react';
import { Character } from '../../components/Character';
import { QuestionCard } from '../../components/QuestionCard';
import type { Content } from '../../data/content';
import type { QuizAnswer, QuizItem } from '../../types/question';

type Props = {
  items: QuizItem[];
  content: Content;
  onFinish: (answers: QuizAnswer[]) => void;
  onExit: () => void;
};

export function QuizPage({ items, content, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const item = items[index];
  const country = content.countries.find((c) => c.id === item?.countryId);
  if (!item || !country) {
    return (
      <section className="card">
        <p>문제를 준비하지 못했어요.</p>
        <button className="btn" onClick={onExit}>홈으로</button>
      </section>
    );
  }

  const correct = selectedId === item.countryId;
  const isLast = index === items.length - 1;

  const select = (countryId: string) => {
    if (selectedId !== null) return;
    setSelectedId(countryId);
    setAnswers((prev) => [
      ...prev,
      { questionId: item.questionId, countryId: item.countryId, correct: countryId === item.countryId },
    ]);
  };

  const next = () => {
    if (isLast) {
      onFinish(answers);
      return;
    }
    setIndex(index + 1);
    setSelectedId(null);
  };

  return (
    <div className="quiz">
      <header className="quiz-header">
        <button type="button" className="link" onClick={onExit}>← 그만하기</button>
        <span className="progress-label" aria-live="polite">{index + 1} / {items.length}</span>
      </header>
      <div className="progress-bar" aria-hidden="true">
        <div style={{ width: `${((index + (selectedId ? 1 : 0)) / items.length) * 100}%` }} />
      </div>

      <QuestionCard item={item} country={country} content={content} selectedId={selectedId} onSelect={select} />

      {selectedId !== null && (
        <section className={`card feedback ${correct ? 'good' : 'oops'}`} role="status">
          <Character mood={correct ? 'cheer' : 'think'} size={56} />
          <div>
            <strong>
              {correct
                ? '⭕ 정답이에요! 잘했어요!'
                : item.type === 'flag'
                  ? `💡 아쉬워요! 정답은 ${country.nameKo} 국기예요.`
                  : `💡 아쉬워요! 정답은 ${country.capitalKo}예요.`}
            </strong>
            <p>
              {item.type === 'flag' ? `이 국기는 ${country.nameKo}의 국기예요. ` : ''}
              {country.capitalKo}은(는) {country.nameKo}의 수도예요. {country.factKo}
            </p>
          </div>
        </section>
      )}

      {selectedId !== null && (
        <button type="button" className="btn primary" onClick={next}>
          {isLast ? '결과 보기' : '다음 문제'}
        </button>
      )}
    </div>
  );
}
