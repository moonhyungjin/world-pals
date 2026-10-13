import { describe, expect, it } from 'vitest';
import { content } from '../../data/content';
import { defaultProgress, sanitizeProgress } from '../../lib/saveData';
import { parseImport } from '../lab/importExport';
import { hasErrors, validateContent } from '../lab/validators';
import { CHARACTER_ASSET_KEYS, characterImageUrl } from './characterAssets';
import { activeCharacter, isNewPlayer, selectableCharacters, setCharacter } from './characterEngine';

const fresh = () => structuredClone(content);

describe('캐릭터 데이터', () => {
  it('ID/이름이 고유하고 모든 그림 파일이 실제로 있다', () => {
    const ids = content.characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(content.characters.map((c) => c.nameKo)).size).toBe(ids.length);
    for (const c of content.characters) {
      expect(CHARACTER_ASSET_KEYS, c.id).toContain(c.assetKey);
      expect(characterImageUrl(c.assetKey), c.id).toBeTruthy();
    }
  });
  it('고를 수 있는 캐릭터가 2개 이상이고 기본(첫 번째)은 폭시다', () => {
    const list = selectableCharacters(content);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].nameKo).toBe('폭시');
  });
  it('기본 콘텐츠는 검증 오류가 없다', () => {
    expect(hasErrors(validateContent(fresh()))).toBe(false);
  });
});

describe('캐릭터 고르기 로직', () => {
  it('고르지 않았으면 첫 번째 캐릭터', () => {
    expect(activeCharacter(content, defaultProgress())?.id).toBe('character.fox');
  });
  it('고른 캐릭터가 적용되고 저장 값은 ID뿐이다', () => {
    const p = setCharacter(defaultProgress(), content, 'character.bunny');
    expect(p.characterId).toBe('character.bunny');
    expect(activeCharacter(content, p)?.nameKo).toBe('토토');
  });
  it('없는 ID나 검수 완료가 아닌 캐릭터는 고를 수 없고 기록이 바뀌지 않는다', () => {
    const p = defaultProgress();
    expect(setCharacter(p, content, 'character.nope')).toBe(p);
    const c = fresh();
    c.characters.find((x) => x.id === 'character.cat')!.status = 'draft';
    expect(setCharacter(p, c, 'character.cat')).toBe(p);
    expect(selectableCharacters(c).map((x) => x.id)).not.toContain('character.cat');
  });
  it('같은 캐릭터를 다시 고르면 기록을 새로 만들지 않는다', () => {
    const p = setCharacter(defaultProgress(), content, 'character.penguin');
    expect(setCharacter(p, content, 'character.penguin')).toBe(p);
  });
  it('고른 캐릭터가 콘텐츠에서 사라지면 첫 번째 캐릭터로 돌아간다 (앱이 멈추지 않음)', () => {
    const p = { ...defaultProgress(), characterId: 'character.cat' };
    const c = fresh();
    c.characters = c.characters.filter((x) => x.id !== 'character.cat');
    expect(activeCharacter(c, p)?.id).toBe('character.fox');
    c.characters = [];
    expect(activeCharacter(c, p)).toBeNull();
  });
  it('새 플레이어 판단: 한 번도 탐험하지 않았을 때만', () => {
    expect(isNewPlayer(defaultProgress())).toBe(true);
    expect(isNewPlayer({ ...defaultProgress(), totalAnswered: 1 })).toBe(false);
    expect(isNewPlayer({ ...defaultProgress(), completedDates: ['2026-10-13'] })).toBe(false);
  });
  it('저장 데이터의 잘못된 값은 null로 복구된다', () => {
    expect(sanitizeProgress({ characterId: 5 }).characterId).toBeNull();
    expect(sanitizeProgress({ characterId: '' }).characterId).toBeNull();
    expect(sanitizeProgress({ characterId: 'character.cat' }).characterId).toBe('character.cat');
  });
});

describe('Lab: 캐릭터 검증과 호환', () => {
  const msgs = (c: ReturnType<typeof fresh>) => validateContent(c).map((i) => `${i.severity}:${i.kind}:${i.id}:${i.message}`);
  it('없는 그림 파일/중복 ID/빈 이름을 찾는다', () => {
    const c = fresh();
    c.characters[0].assetKey = 'dragon';
    c.characters[1].id = c.characters[2].id;
    c.characters[3].nameKo = ' ';
    const m = msgs(c);
    expect(m.some((x) => x.startsWith('error:character') && x.includes('"dragon"'))).toBe(true);
    expect(m.some((x) => x.includes('캐릭터 ID') && x.includes('중복'))).toBe(true);
    expect(m.some((x) => x.startsWith('error:character') && x.includes('이름을 입력'))).toBe(true);
  });
  it('검수 완료 캐릭터가 하나도 없으면 주의를 준다 (오류는 아님)', () => {
    const c = fresh();
    c.characters.forEach((x) => (x.status = 'draft'));
    expect(msgs(c).some((x) => x.startsWith('warning:character') && x.includes('기본 그림'))).toBe(true);
    expect(hasErrors(validateContent(c))).toBe(false);
  });
  it('캐릭터가 없던 예전 백업 파일도 읽는다', () => {
    const old = { countries: [], questions: [], badges: [], cosmetics: [], companions: [] };
    const r = parseImport(JSON.stringify(old));
    expect(r.ok && r.content.characters).toEqual([]);
    expect(r.ok && r.notes.join(' ')).toContain('캐릭터 목록이 없어서');
    expect(parseImport(JSON.stringify({ ...old, characters: 7 })).ok).toBe(false);
  });
});
