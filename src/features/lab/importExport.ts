import type { Content } from '../../data/content';
import type { Companion } from '../../types/companion';
import type { Country } from '../../types/country';
import type { Question } from '../../types/question';
import type { Badge, BadgeCondition, Cosmetic } from '../../types/reward';

export const BUNDLE_FORMAT = 'world-pals-content';
export const BUNDLE_VERSION = 1;

export type ImportResult = { ok: true; content: Content; notes: string[] } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function normalizeCountry(o: Obj): Country {
  const c: Country = {
    id: str(o.id),
    nameKo: str(o.nameKo),
    capitalKo: str(o.capitalKo),
    continent: str(o.continent),
    flag: str(o.flag),
    factKo: str(o.factKo),
    status: str(o.status, 'draft') as Country['status'],
  };
  if (num(o.latitude) !== undefined) c.latitude = num(o.latitude);
  if (num(o.longitude) !== undefined) c.longitude = num(o.longitude);
  if (Array.isArray(o.aliases)) c.aliases = o.aliases.filter((a): a is string => typeof a === 'string');
  if (typeof o.sourceNote === 'string') c.sourceNote = o.sourceNote;
  return c;
}

function normalizeQuestion(o: Obj): Question {
  const q: Question = {
    id: str(o.id),
    type: str(o.type, 'capital') as Question['type'],
    countryId: str(o.countryId),
    distractorCountryIds: Array.isArray(o.distractorCountryIds)
      ? o.distractorCountryIds.filter((x): x is string => typeof x === 'string')
      : [],
    difficulty: (num(o.difficulty) ?? 2) as Question['difficulty'],
    status: str(o.status, 'draft') as Question['status'],
  };
  if (typeof o.hintKo === 'string') q.hintKo = o.hintKo;
  if (typeof o.explanationKo === 'string') q.explanationKo = o.explanationKo;
  return q;
}

function normalizeCondition(v: unknown): BadgeCondition {
  const o = isObj(v) ? v : {};
  const count = num(o.count) ?? 1;
  const type = str(o.type);
  if (type === 'continentDiscovered') return { type, continent: str(o.continent), count };
  return { type: type as Exclude<BadgeCondition['type'], 'continentDiscovered'>, count };
}

function normalizeBadge(o: Obj): Badge {
  return {
    id: str(o.id),
    nameKo: str(o.nameKo),
    descriptionKo: str(o.descriptionKo),
    emoji: str(o.emoji),
    condition: normalizeCondition(o.condition),
    status: str(o.status, 'draft') as Badge['status'],
  };
}

function normalizeCosmetic(o: Obj): Cosmetic {
  return {
    id: str(o.id),
    nameKo: str(o.nameKo),
    descriptionKo: str(o.descriptionKo),
    slot: str(o.slot, 'head') as Cosmetic['slot'],
    emoji: str(o.emoji),
    cost: num(o.cost) ?? 0,
    status: str(o.status, 'draft') as Cosmetic['status'],
  };
}

function normalizeCompanion(o: Obj): Companion {
  const c: Companion = {
    id: str(o.id),
    countryId: str(o.countryId),
    nameKo: str(o.nameKo),
    emoji: str(o.emoji),
    descriptionKo: str(o.descriptionKo),
    status: str(o.status, 'draft') as Companion['status'],
  };
  if (typeof o.sourceNote === 'string') c.sourceNote = o.sourceNote;
  return c;
}

/** 가져온 텍스트를 해석한다. 형식이 잘못돼도 예외 없이 사람이 읽을 수 있는 오류 목록을 돌려준다. */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON 형식이 올바르지 않아요. 파일이 깨졌거나 JSON이 아닌 내용이에요.'] };
  }
  if (!isObj(raw)) return { ok: false, errors: ['최상위 값이 객체가 아니에요. World Pals 내보내기 파일이 맞는지 확인해 주세요.'] };

  const errors: string[] = [];
  const notes: string[] = [];
  if (raw.format !== undefined && raw.format !== BUNDLE_FORMAT) {
    errors.push(`파일 형식 "${String(raw.format)}"은(는) World Pals 콘텐츠가 아니에요.`);
  }
  if (typeof raw.version === 'number' && raw.version > BUNDLE_VERSION) {
    errors.push(`더 새로운 버전(${raw.version})의 파일이에요. 이 Lab은 버전 ${BUNDLE_VERSION}까지 읽을 수 있어요.`);
  }

  const collect = <T>(key: string, label: string, normalize: (o: Obj) => T): T[] => {
    const arr = raw[key];
    if (!Array.isArray(arr)) {
      errors.push(`"${key}"(${label}) 목록이 없어요.`);
      return [];
    }
    const out: T[] = [];
    arr.forEach((item, i) => {
      if (isObj(item)) out.push(normalize(item));
      else errors.push(`${label} ${i + 1}번째 항목이 올바른 객체가 아니에요.`);
    });
    return out;
  };

  const content: Content = {
    countries: collect('countries', '국가', normalizeCountry),
    questions: collect('questions', '문제', normalizeQuestion),
    badges: collect('badges', '배지', normalizeBadge),
    cosmetics: collect('cosmetics', '장식', normalizeCosmetic),
    // 탐험 친구가 생기기 전에 만든 백업 파일에는 없을 수 있다.
    companions: raw.companions === undefined ? [] : collect('companions', '탐험 친구', normalizeCompanion),
  };
  if (errors.length > 0) return { ok: false, errors };
  notes.push(
    `국가 ${content.countries.length}개, 문제 ${content.questions.length}개, 배지 ${content.badges.length}개, 장식 ${content.cosmetics.length}개, 탐험 친구 ${content.companions.length}개를 읽었어요.`,
  );
  if (raw.companions === undefined) notes.push('이 파일에는 탐험 친구 목록이 없어서 빈 목록으로 가져와요.');
  return { ok: true, content, notes };
}

/** 백업/이동용 전체 번들. 오류가 있어도 내보낼 수 있다(작업 보존용). */
export function exportBundle(content: Content, now: Date = new Date()): string {
  return JSON.stringify({ format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: now.toISOString(), ...content }, null, 2) + '\n';
}

/** 게임이 읽는 파일 4개(src/data/*.json)와 같은 형태. 이 파일들로 교체하면 게임에 반영된다. */
export function gameDataFiles(content: Content): { name: string; text: string }[] {
  const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
  return [
    { name: 'countries.json', text: json(content.countries) },
    { name: 'questions.json', text: json(content.questions) },
    { name: 'badges.json', text: json(content.badges) },
    { name: 'rewards.json', text: json(content.cosmetics) },
    { name: 'companions.json', text: json(content.companions) },
  ];
}

export function timestampForFile(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
