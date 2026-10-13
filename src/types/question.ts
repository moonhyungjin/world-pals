import type { ContentStatus } from './country';

export type QuestionType = 'capital'; // 이후 'flag' | 'map' 등으로 확장

export type Question = {
  id: string;
  type: QuestionType;
  countryId: string; // 정답이 되는 국가
  distractorCountryIds: string[]; // 오답 보기가 될 국가 ID (3개)
  hintKo?: string;
  explanationKo?: string; // 없으면 국가의 factKo를 사용
  difficulty: 1 | 2 | 3;
  status: ContentStatus;
};

/** 화면에 보여줄 한 문제. 보기는 이미 섞인 상태. */
export type QuizItem = {
  questionId: string;
  countryId: string;
  choices: { countryId: string; label: string }[];
};

export type QuizAnswer = { questionId: string; countryId: string; correct: boolean };
