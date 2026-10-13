import type { Content } from '../../data/content';

export type Severity = 'error' | 'warning';
export type ContentKind = 'country' | 'question' | 'badge' | 'cosmetic';

export type Issue = { severity: Severity; kind: ContentKind; id: string; message: string };

const STATUSES = ['draft', 'review', 'verified'];
const QUESTION_TYPES = ['capital', 'flag'];
const SLOTS = ['head', 'face', 'neck', 'back'];
const CONDITION_TYPES = [
  'sessionsCompleted',
  'countriesDiscovered',
  'continentDiscovered',
  'questionsAnswered',
  'reviewCorrect',
];

const blank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

/** 콘텐츠 전체를 검사해 사람이 읽을 수 있는 메시지로 돌려준다. error가 있으면 게임 데이터로 내보낼 수 없다. */
export function validateContent(content: Content): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Severity, kind: ContentKind, id: string, message: string) =>
    issues.push({ severity, kind, id: id || '(ID 없음)', message });

  const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  const countryById = new Map(content.countries.map((c) => [c.id, c]));

  // ---- 국가 ----
  for (const id of new Set(duplicates(content.countries.map((c) => c.id)))) {
    add('error', 'country', id, `국가 ID "${id}"가 중복돼요. ID는 서로 달라야 해요.`);
  }
  for (const c of content.countries) {
    if (blank(c.id)) add('error', 'country', c.id, '국가 ID가 비어 있어요.');
    else if (/\s/.test(c.id)) add('error', 'country', c.id, '국가 ID에는 공백을 쓸 수 없어요.');
    if (blank(c.nameKo)) add('error', 'country', c.id, '한국어 국가명을 입력해 주세요.');
    if (blank(c.capitalKo)) add('error', 'country', c.id, '수도명을 입력해 주세요.');
    if (blank(c.continent)) add('error', 'country', c.id, '대륙을 입력해 주세요.');
    if (blank(c.factKo)) add('warning', 'country', c.id, '어린이용 지리 상식이 비어 있어요.');
    if (!STATUSES.includes(c.status)) add('error', 'country', c.id, `검수 상태 "${c.status}"를 알 수 없어요.`);
    if (c.latitude !== undefined && !(c.latitude >= -90 && c.latitude <= 90)) {
      add('error', 'country', c.id, '위도는 -90 ~ 90 사이여야 해요.');
    }
    if (c.longitude !== undefined && !(c.longitude >= -180 && c.longitude <= 180)) {
      add('error', 'country', c.id, '경도는 -180 ~ 180 사이여야 해요.');
    }
    if (c.status === 'verified' && blank(c.sourceNote)) {
      add('warning', 'country', c.id, '검수 완료(verified)인데 데이터 출처 메모가 없어요.');
    }
    if (!/^[A-Za-z]{2}$/.test(c.id)) {
      add('warning', 'country', c.id, '국기 이미지는 2글자 ISO 국가 코드 ID(예: KR)일 때만 표시돼요.');
    }
  }

  // ---- 문제 ----
  for (const id of new Set(duplicates(content.questions.map((q) => q.id)))) {
    add('error', 'question', id, `문제 ID "${id}"가 중복돼요.`);
  }
  for (const q of content.questions) {
    if (blank(q.id)) add('error', 'question', q.id, '문제 ID가 비어 있어요.');
    if (!QUESTION_TYPES.includes(q.type)) add('error', 'question', q.id, `문제 유형 "${q.type}"를 알 수 없어요.`);
    if (!STATUSES.includes(q.status)) add('error', 'question', q.id, `검수 상태 "${q.status}"를 알 수 없어요.`);
    if (![1, 2, 3].includes(q.difficulty)) add('error', 'question', q.id, '난이도는 1~3 중 하나여야 해요.');

    const answer = countryById.get(q.countryId);
    if (!answer) {
      add('error', 'question', q.id, `정답 국가 ID "${q.countryId}"가 존재하지 않아요.`);
      continue;
    }
    const ds = q.distractorCountryIds ?? [];
    if (ds.length !== 3) add('error', 'question', q.id, `오답 보기는 정확히 3개여야 해요. (지금 ${ds.length}개)`);
    if (ds.includes(q.countryId)) add('error', 'question', q.id, '정답 국가가 오답 보기에도 들어 있어요. 정답은 보기에 한 번만 있어야 해요.');
    if (new Set(ds).size !== ds.length) add('error', 'question', q.id, '오답 보기가 서로 중복돼요.');

    const labels = [q.type === 'capital' ? answer.capitalKo : answer.nameKo];
    for (const id of ds) {
      const c = countryById.get(id);
      if (!c) {
        add('error', 'question', q.id, `오답 보기 국가 ID "${id}"가 존재하지 않아요.`);
        continue;
      }
      const label = q.type === 'capital' ? c.capitalKo : c.nameKo;
      if (labels.includes(label)) {
        add('error', 'question', q.id, `보기 "${label}"가 중복돼요. 보기는 서로 달라야 해요.`);
      }
      labels.push(label);
      if (q.status === 'verified' && c.status !== 'verified') {
        add('warning', 'question', q.id, `오답 보기 "${c.nameKo}"가 검수 완료 상태가 아니라서 이 문제는 출제되지 않아요.`);
      }
    }
    if (q.status === 'verified' && answer.status !== 'verified') {
      add('warning', 'question', q.id, `정답 국가 "${answer.nameKo}"가 검수 완료 상태가 아니라서 이 문제는 출제되지 않아요.`);
    }
    if (q.status !== 'verified') add('warning', 'question', q.id, '초안/검수 중 문제라서 기본 출제에서 제외돼요.');
  }

  // ---- 장식 ----
  const rewardIds = [...content.cosmetics.map((c) => c.id), ...content.badges.map((b) => b.id)];
  for (const id of new Set(duplicates(rewardIds))) {
    add('error', 'cosmetic', id, `보상 ID "${id}"가 중복돼요. 보상 ID는 배지와 장식 전체에서 고유해야 중복 지급을 막을 수 있어요.`);
  }
  for (const c of content.cosmetics) {
    if (blank(c.id)) add('error', 'cosmetic', c.id, '장식 ID가 비어 있어요.');
    if (blank(c.nameKo)) add('error', 'cosmetic', c.id, '표시 이름을 입력해 주세요.');
    if (!Number.isInteger(c.cost) || c.cost < 0) add('error', 'cosmetic', c.id, '비용은 0 이상의 정수여야 해요.');
    if (!SLOTS.includes(c.slot)) add('error', 'cosmetic', c.id, `장착 위치 "${c.slot}"를 알 수 없어요.`);
    if (blank(c.emoji)) add('error', 'cosmetic', c.id, '이미지(이모지)를 입력해 주세요.');
    if (!STATUSES.includes(c.status)) add('error', 'cosmetic', c.id, `상태 "${c.status}"를 알 수 없어요.`);
  }

  // ---- 배지 ----
  const continents = new Set(content.countries.map((c) => c.continent));
  for (const b of content.badges) {
    if (blank(b.id)) add('error', 'badge', b.id, '배지 ID가 비어 있어요.');
    if (blank(b.nameKo)) add('error', 'badge', b.id, '표시 이름을 입력해 주세요.');
    if (blank(b.descriptionKo)) add('warning', 'badge', b.id, '배지 설명이 비어 있어요.');
    if (!STATUSES.includes(b.status)) add('error', 'badge', b.id, `상태 "${b.status}"를 알 수 없어요.`);
    const cond = b.condition;
    if (!cond || !CONDITION_TYPES.includes(cond.type)) {
      add('error', 'badge', b.id, '해금 조건 유형을 알 수 없어요.');
      continue;
    }
    if (!Number.isInteger(cond.count) || cond.count < 1) add('error', 'badge', b.id, '조건 개수는 1 이상의 정수여야 해요.');
    if (cond.type === 'continentDiscovered') {
      if (blank(cond.continent)) add('error', 'badge', b.id, '조건의 대륙을 입력해 주세요.');
      else if (!continents.has(cond.continent)) add('error', 'badge', b.id, `조건의 대륙 "${cond.continent}"에 해당하는 국가가 없어요.`);
    }
  }
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');
