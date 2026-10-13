import type { Country } from '../types/country';
import type { QuizItem } from '../types/question';
import { Flag } from './Flag';

type Props = {
  item: QuizItem;
  country: Country;
  selectedId: string | null;
  onSelect: (countryId: string) => void;
};

export function QuestionCard({ item, country, selectedId, onSelect }: Props) {
  const answered = selectedId !== null;
  return (
    <section className="card question-card">
      <div className="flag"><Flag country={country} /></div>
      <h2 className="question">{country.nameKo}의 수도는 어디일까요?</h2>
      <div className="choices">
        {item.choices.map((choice) => {
          const isAnswer = choice.countryId === item.countryId;
          const isPicked = choice.countryId === selectedId;
          let state = '';
          let mark = '';
          if (answered && isAnswer) {
            state = 'correct';
            mark = '⭕ ';
          } else if (answered && isPicked) {
            state = 'wrong';
            mark = '💡 ';
          }
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
