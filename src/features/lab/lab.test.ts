import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { content as builtIn, type Content } from '../../data/content';
import { seededRng } from '../../lib/random';
import { defaultProgress, loadProgress, saveProgress } from '../../lib/saveData';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { completeSession } from '../rewards/rewardEngine';
import { exportBundle, gameDataFiles, parseImport } from './importExport';
import { addSnapshot, loadDraft, loadSnapshots, saveDraft } from './labStorage';
import {
  deleteCountry,
  duplicateCountry,
  generateQuestionDraft,
  newCountry,
  questionsLinkedToCountry,
  uniqueId,
} from './labOps';
import { hasErrors, validateContent } from './validators';

const fresh = (): Content => structuredClone(builtIn);
const msgs = (c: Content) => validateContent(c).map((i) => `${i.severity}:${i.kind}:${i.id}:${i.message}`);

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage(); });
afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

describe('validateContent', () => {
  it('게임에 들어 있는 기본 콘텐츠에는 오류가 없다', () => {
    expect(hasErrors(validateContent(fresh()))).toBe(false);
  });
  it('중복 국가 ID를 찾는다', () => {
    const c = fresh();
    c.countries.push({ ...c.countries[0] });
    expect(msgs(c).some((m) => m.startsWith('error:country:KR') && m.includes('중복'))).toBe(true);
  });
  it('필수값이 비면 오류', () => {
    const c = fresh();
    c.countries[0].nameKo = ' ';
    c.countries[0].capitalKo = '';
    const m = msgs(c);
    expect(m.some((x) => x.includes('국가명'))).toBe(true);
    expect(m.some((x) => x.includes('수도명'))).toBe(true);
  });
  it('존재하지 않는 국가 ID 참조를 찾는다', () => {
    const c = fresh();
    c.questions[0].countryId = 'ZZ';
    c.questions[1].distractorCountryIds[0] = 'QQ';
    const m = msgs(c);
    expect(m.some((x) => x.includes('"ZZ"가 존재하지 않아요'))).toBe(true);
    expect(m.some((x) => x.includes('"QQ"가 존재하지 않아요'))).toBe(true);
  });
  it('정답이 오답 보기에도 있거나 보기가 중복되면 오류', () => {
    const c = fresh();
    const q = c.questions.find((x) => x.id === 'q.capital.KR')!;
    q.distractorCountryIds = ['KR', 'JP', 'JP'];
    const m = msgs(c);
    expect(m.some((x) => x.includes('정답은 보기에 한 번만'))).toBe(true);
    expect(m.some((x) => x.includes('서로 중복'))).toBe(true);
  });
  it('수도가 같은 국가가 보기에 함께 있으면 오류', () => {
    const c = fresh();
    c.countries.find((x) => x.id === 'JP')!.capitalKo = '서울';
    const q = c.questions.find((x) => x.id === 'q.capital.KR')!;
    q.distractorCountryIds = ['JP', 'CN', 'FR'];
    expect(msgs(c).some((x) => x.includes('보기 "서울"가 중복'))).toBe(true);
  });
  it('오답 보기가 3개가 아니면 오류', () => {
    const c = fresh();
    c.questions[0].distractorCountryIds = c.questions[0].distractorCountryIds.slice(0, 2);
    expect(msgs(c).some((x) => x.includes('정확히 3개'))).toBe(true);
  });
  it('verified 문제의 국가가 verified가 아니면 출제 제외 경고', () => {
    const c = fresh();
    c.countries.find((x) => x.id === 'KR')!.status = 'review';
    expect(msgs(c).some((x) => x.startsWith('warning:question:q.capital.KR') && x.includes('출제되지 않아요'))).toBe(true);
  });
  it('보상: 음수 비용, 필수 이름, ID 중복, 알 수 없는 대륙', () => {
    const c = fresh();
    c.cosmetics[0].cost = -1;
    c.cosmetics[1].nameKo = '';
    c.badges[0].id = c.cosmetics[2].id;
    c.badges[2].condition = { type: 'continentDiscovered', continent: '달나라', count: 3 };
    const m = msgs(c);
    expect(m.some((x) => x.includes('비용은 0 이상'))).toBe(true);
    expect(m.some((x) => x.includes('표시 이름'))).toBe(true);
    expect(m.some((x) => x.includes('보상 ID') && x.includes('중복'))).toBe(true);
    expect(m.some((x) => x.includes('"달나라"'))).toBe(true);
  });
});

describe('parseImport / export', () => {
  it('내보낸 번들을 다시 읽으면 같은 내용이다', () => {
    const r = parseImport(exportBundle(fresh()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toEqual(fresh());
  });
  it('깨진 JSON은 예외 없이 오류 안내', () => {
    const r = parseImport('{"countries": [');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('JSON 형식');
  });
  it('엉뚱한 형식/빈 값/배열 최상위도 안전하게 거부', () => {
    for (const text of ['', 'null', '[]', '123', '"x"', '{}', '{"format":"other"}']) {
      expect(parseImport(text).ok).toBe(false);
    }
  });
  it('목록 안에 객체가 아닌 항목이 있으면 몇 번째인지 알려준다', () => {
    const r = parseImport(JSON.stringify({ countries: [1], questions: [], badges: [], cosmetics: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('국가 1번째');
  });
  it('필드가 빠진 항목은 읽되 검증에서 오류로 드러난다', () => {
    const r = parseImport(JSON.stringify({ countries: [{ id: 'XX' }], questions: [{ id: 'q1' }], badges: [{}], cosmetics: [{}] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(hasErrors(validateContent(r.content))).toBe(true);
  });
  it('더 높은 버전 파일은 거부', () => {
    const r = parseImport(JSON.stringify({ version: 99, countries: [], questions: [], badges: [], cosmetics: [] }));
    expect(r.ok).toBe(false);
  });
  it('게임 데이터 파일 4개는 src/data 형식과 같다', () => {
    const files = gameDataFiles(fresh());
    expect(files.map((f) => f.name)).toEqual(['countries.json', 'questions.json', 'badges.json', 'rewards.json']);
    expect(JSON.parse(files[0].text)).toEqual(builtIn.countries);
    expect(JSON.parse(files[3].text)).toEqual(builtIn.cosmetics);
  });
});

describe('labOps', () => {
  it('uniqueId는 겹치지 않는 ID를 만든다', () => {
    expect(uniqueId('A', ['A', 'A_2'])).toBe('A_3');
    expect(uniqueId('B', ['A'])).toBe('B');
  });
  it('새 국가/복제 국가 ID는 중복되지 않고 초안 상태다', () => {
    const c = fresh();
    expect(c.countries.some((x) => x.id === newCountry(c).id)).toBe(false);
    const dup = duplicateCountry(c, 'KR')!;
    expect(dup.id).not.toBe('KR');
    expect(dup.status).toBe('draft');
    expect(dup.nameKo).toBe('대한민국');
  });
  it('수도/국기 문제 초안을 만든다 (draft, 보기 중복 없음, 존재하는 국가만)', () => {
    const c = fresh();
    c.questions = [];
    for (const type of ['capital', 'flag'] as const) {
      const q = generateQuestionDraft(c, 'KR', type, seededRng(5))!;
      expect(q.status).toBe('draft');
      expect(q.distractorCountryIds).toHaveLength(3);
      expect(q.distractorCountryIds).not.toContain('KR');
      expect(new Set(q.distractorCountryIds).size).toBe(3);
      expect(hasErrors(validateContent({ ...c, questions: [q] }))).toBe(false);
    }
  });
  it('이미 있는 문제 ID와 겹치지 않는다', () => {
    const q = generateQuestionDraft(fresh(), 'KR', 'capital', seededRng(1))!;
    expect(q.id).toBe('q.capital.KR_2');
  });
  it('보기를 만들 국가가 부족하면 만들지 않는다', () => {
    const c = fresh();
    c.countries = c.countries.slice(0, 3);
    expect(generateQuestionDraft(c, c.countries[0].id, 'capital')).toBeUndefined();
  });
  it('연결된 문제 확인과 국가 삭제', () => {
    const c = fresh();
    const linked = questionsLinkedToCountry(c, 'KR');
    expect(linked.asAnswer.map((q) => q.id).sort()).toEqual(['q.capital.KR', 'q.flag.KR']);
    expect(linked.asDistractor.length).toBeGreaterThan(0);
    const after = deleteCountry(c, 'KR');
    expect(after.countries.some((x) => x.id === 'KR')).toBe(false);
    expect(after.questions.some((q) => q.countryId === 'KR')).toBe(false);
    // 오답 보기로 쓰이던 문제는 검증에서 잡힌다
    expect(hasErrors(validateContent(after))).toBe(true);
  });
});

describe('Lab 저장과 플레이어 기록 분리', () => {
  it('저장 키가 모두 다르다', () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('초안 임시 저장/복원, 깨진 초안이면 기본 콘텐츠로 시작', () => {
    expect(loadDraft().restored).toBe(false);
    const c = fresh();
    c.countries[0].nameKo = '수정됨';
    expect(saveDraft(c)).toBe(true);
    const d = loadDraft();
    expect(d.restored).toBe(true);
    expect(d.content.countries[0].nameKo).toBe('수정됨');
    localStorage.setItem(STORAGE_KEYS.labDraft, '{깨짐');
    expect(loadDraft().restored).toBe(false);
  });
  it('버전 사본은 최대 10개까지 최신순으로 보관된다', () => {
    for (let i = 0; i < 12; i++) addSnapshot(fresh(), `사본 ${i}`, new Date(2026, 0, 1, 0, 0, i));
    const list = loadSnapshots();
    expect(list).toHaveLength(10);
    expect(list[0].label).toBe('사본 11');
  });
  it('테스트 플레이는 실제 진행 기록(저장 키)을 바꾸지 않는다', () => {
    const real = { ...defaultProgress(), totalStars: 7 };
    saveProgress(real);
    const test = loadProgress(STORAGE_KEYS.labTestProgress);
    const done = completeSession(
      test,
      [{ questionId: 'q.capital.KR', countryId: 'KR', correct: true }],
      '2026-10-13',
      builtIn,
    );
    saveProgress(done.progress, STORAGE_KEYS.labTestProgress);
    expect(loadProgress().totalStars).toBe(7);
    expect(loadProgress(STORAGE_KEYS.labTestProgress).totalStars).toBeGreaterThan(0);
  });
});
