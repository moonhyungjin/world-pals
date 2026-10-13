import type { Country } from '../types/country';
import type { Question } from '../types/question';
import type { Badge, Cosmetic } from '../types/reward';
import badgesJson from './badges.json';
import countriesJson from './countries.json';
import questionsJson from './questions.json';
import rewardsJson from './rewards.json';

export type Content = {
  countries: Country[];
  questions: Question[];
  badges: Badge[];
  cosmetics: Cosmetic[];
};

/** 게임이 읽는 콘텐츠. 이후 Lab에서 내보낸 JSON으로 교체해도 같은 형태를 유지한다. */
export const content: Content = {
  countries: countriesJson as unknown as Country[],
  questions: questionsJson as unknown as Question[],
  badges: badgesJson as unknown as Badge[],
  cosmetics: rewardsJson as unknown as Cosmetic[],
};
