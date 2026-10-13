import type { Content } from '../../data/content';
import { shuffle, type Rng } from '../../lib/random';
import type { Country } from '../../types/country';
import type { Question, QuestionType } from '../../types/question';

/** 이미 있는 ID와 겹치지 않는 ID를 만든다. (base, base_2, base_3 ...) */
export function uniqueId(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function newCountry(content: Content): Country {
  return {
    id: uniqueId('NEW', content.countries.map((c) => c.id)),
    nameKo: '',
    capitalKo: '',
    continent: '',
    flag: '',
    factKo: '',
    aliases: [],
    status: 'draft',
    sourceNote: '',
  };
}

export function duplicateCountry(content: Content, id: string): Country | undefined {
  const src = content.countries.find((c) => c.id === id);
  if (!src) return undefined;
  return { ...src, id: uniqueId(`${src.id}_copy`, content.countries.map((c) => c.id)), status: 'draft' };
}

export const questionIdFor = (type: QuestionType, countryId: string) => `q.${type}.${countryId}`;

/** 국가를 바탕으로 4지선다 문제 초안을 만든다. 오답 보기는 다른 국가에서 (중복 없이) 고른다. 상태는 항상 draft. */
export function generateQuestionDraft(
  content: Content,
  countryId: string,
  type: QuestionType,
  rng: Rng = Math.random,
): Question | undefined {
  const answer = content.countries.find((c) => c.id === countryId);
  if (!answer) return undefined;
  const key = (c: Country) => (type === 'capital' ? c.capitalKo : c.nameKo);
  const pool = content.countries.filter((c) => c.id !== answer.id && c.status === 'verified' && key(c) !== key(answer));
  const picks: Country[] = [];
  for (const c of shuffle(pool, rng)) {
    if (picks.length === 3) break;
    if (!picks.some((p) => key(p) === key(c))) picks.push(c);
  }
  if (picks.length < 3) return undefined; // 보기를 만들 국가가 부족함
  return {
    id: uniqueId(questionIdFor(type, answer.id), content.questions.map((q) => q.id)),
    type,
    countryId: answer.id,
    distractorCountryIds: picks.map((p) => p.id),
    difficulty: 2,
    status: 'draft',
  };
}

/** 국가에 연결된 문제: 정답으로 쓰는 문제와 오답 보기로 쓰는 문제를 나눠 알려준다. */
export function questionsLinkedToCountry(content: Content, countryId: string) {
  return {
    asAnswer: content.questions.filter((q) => q.countryId === countryId),
    asDistractor: content.questions.filter((q) => q.countryId !== countryId && q.distractorCountryIds.includes(countryId)),
  };
}

/** 국가를 삭제한다. 그 국가가 정답인 문제는 함께 삭제하고, 오답 보기로 쓰인 문제는 남겨 두어 검증에서 알려준다. */
export function deleteCountry(content: Content, countryId: string): Content {
  return {
    ...content,
    countries: content.countries.filter((c) => c.id !== countryId),
    questions: content.questions.filter((q) => q.countryId !== countryId),
  };
}

export function replaceById<T extends { id: string }>(list: T[], id: string, next: T): T[] {
  return list.map((item) => (item.id === id ? next : item));
}
