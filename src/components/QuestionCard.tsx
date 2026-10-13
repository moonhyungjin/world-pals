import type { Content } from '../data/content';
import type { Country } from '../types/country';
import type { QuizItem } from '../types/question';
import { Flag } from './Flag';

type Props = {
  item: QuizItem;
  country: Country;
  content: Content;
  selectedId: string | null;
  onSelect: (countryId: string) => void;
};

/** 정답/오답은 색뿐 아니라 아이콘과 글자로도 표시한다. */
function choiceState(answered: boolean, isAnswer: boolean, isPicked: boolean) {
  if (answered && isAnswer) return { state: 'correct', mark: '⭕ ' };
  if (answered && isPicked) return { state: 'wrong', mark: '💡 ' };
  return { state: '', mark: '' };
}

export function QuestionCard({ item, country, content, selectedId, onSelect }: Props) {
  const answered = selectedId !== null;

  if (item.type === 'flag') {
    return (
      <section className="card question-card">
        <h2 className="question flag-question">
          <span className="flag-question-name">{country.nameKo}</span>의 국기는 어느 것일까요?
        </h2>
        <div className="choices flag-choices">
          {item.choices.map((choice, index) => {
            const c = content.countries.find((x) => x.id === choice.countryId);
            const { state, mark } = choiceState(answered, choice.countryId === item.countryId, choice.countryId === selectedId);
            return (
              <button
                key={choice.countryId}
                type="button"
                className={`choice flag-choice ${state}`}
                disabled={answered}
                aria-label={answered ? `${choice.label} 국기` : `${index + 1}번 국기`}
                onClick={() => onSelect(choice.countryId)}
              >
                {c && <Flag country={c} decorative />}
                {/* 이름은 답을 고른 뒤에만 보여준다 (미리 보이면 문제가 되지 않음) */}
                <span className="flag-choice-label">{answered ? `${mark}${choice.label}` : ' '}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="card question-card">
      <div className="flag"><Flag country={country} /></div>
      <h2 className="question">{country.nameKo}의 수도는 어디일까요?</h2>
      <div className="choices">
        {item.choices.map((choice) => {
          const { state, mark } = choiceState(answered, choice.countryId === item.countryId, choice.countryId === selectedId);
          return (
            <button
              key={choice.countryId}
              type="button"
              className={`choice ${state}`}
              disabled={answered}
              onClick={() => onSelect(choice.countryId)}
            >
              {mark}
              {choice.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
