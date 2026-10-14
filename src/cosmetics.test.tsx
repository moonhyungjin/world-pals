import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Character } from './components/Character';
import { content } from './data/content';
import { COSMETIC_ASSET_KEYS, cosmeticImageUrl } from './features/rewards/cosmeticAssets';
import { exportBundle, parseImport } from './features/lab/importExport';
import { hasErrors, validateContent } from './features/lab/validators';
import type { Cosmetic } from './types/reward';

const cos = (id: string) => content.cosmetics.find((c) => c.id === id)!;
const char = (id: string) => content.characters.find((c) => c.id === id)!;
const render = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');
const fresh = () => structuredClone(content);
const msgs = (c: ReturnType<typeof fresh>) => validateContent(c).map((i) => `${i.severity}:${i.kind}:${i.id}:${i.message}`);

describe('장식 그림 데이터', () => {
  it('모든 장식에 그림 키가 있고, 그림 파일이 실제로 있다', () => {
    for (const c of content.cosmetics) {
      expect(c.assetKey, c.id).toBeTruthy();
      expect(COSMETIC_ASSET_KEYS, c.id).toContain(c.assetKey);
      expect(cosmeticImageUrl(c.assetKey), c.id).toBeTruthy();
    }
  });
  it('같은 그림을 두 장식이 쓰지 않는다', () => {
    const keys = content.cosmetics.map((c) => c.assetKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('캐릭터의 장식 위치 보정값이 올바른 범위다', () => {
    for (const ch of content.characters) {
      for (const [slot, f] of Object.entries(ch.fit ?? {})) {
        expect(['head', 'face', 'neck', 'back'], `${ch.id} ${slot}`).toContain(slot);
        expect(Math.abs(f.dx), ch.id).toBeLessThanOrEqual(80);
        expect(Math.abs(f.dy), ch.id).toBeLessThanOrEqual(80);
        expect(f.s, ch.id).toBeGreaterThanOrEqual(0.3);
        expect(f.s, ch.id).toBeLessThanOrEqual(2);
      }
    }
  });
  it('기본 콘텐츠는 오류도, 이모지 대체에 대한 주의도 없다', () => {
    expect(hasErrors(validateContent(fresh()))).toBe(false);
    expect(msgs(fresh()).some((m) => m.includes('이모지로 보여요'))).toBe(false);
  });
});

describe('장식 그림 그리기', () => {
  it('착용한 장식이 슬롯별 그림(SVG)으로 그려진다', () => {
    const all = ['cosmetic.explorer-hat', 'cosmetic.sunglasses', 'cosmetic.scarf', 'cosmetic.backpack'].map(cos);
    const html = render(<Character equipped={all} character={char('character.fox')} />);
    for (const slot of ['head', 'face', 'neck', 'back']) expect(html).toContain(`cosmetic-art slot-${slot}`);
    expect(html).not.toContain('class="cosmetic slot-'); // 이모지로 대신하지 않음
  });
  it('배낭은 캐릭터 뒤에, 나머지는 앞에 그린다', () => {
    const html = render(<Character equipped={['cosmetic.backpack', 'cosmetic.explorer-hat'].map(cos)} character={char('character.fox')} />);
    const back = html.indexOf('slot-back');
    const face = html.indexOf('character-face');
    const head = html.indexOf('slot-head');
    expect(back).toBeGreaterThan(-1);
    expect(back).toBeLessThan(face);
    expect(face).toBeLessThan(head);
  });
  it('캐릭터별 보정값이 적용된다 (토끼는 선글라스를 아래로, 폭시는 그대로)', () => {
    const glasses = [cos('cosmetic.sunglasses')];
    const bunny = render(<Character equipped={glasses} character={char('character.bunny')} />);
    expect(bunny).toContain('translate(0%, 3.125%) scale(1)'); // dy 10 → 10/320
    const fox = render(<Character equipped={glasses} character={char('character.fox')} />);
    expect(fox).not.toContain('translate(');
    const penguin = render(<Character equipped={glasses} character={char('character.penguin')} />);
    expect(penguin).toContain('scale(0.8)');
  });
  it('장식 상자는 캐릭터의 160%이고 사방 30% 여백을 가진다 (그림 좌표계와 같다)', () => {
    const html = render(<Character equipped={[cos('cosmetic.crown')]} character={char('character.cat')} />);
    expect(html).toContain('left:-30%');
    expect(html).toContain('top:-30%');
    expect(html).toContain('width:160%');
    expect(html).toContain('height:160%');
  });
  it('그림이 없거나 그림 파일을 못 찾으면 이모지로 대신 보여준다 (앱이 멈추지 않음)', () => {
    const noArt: Cosmetic = { ...cos('cosmetic.crown'), id: 'cosmetic.x', assetKey: undefined, emoji: '👑' };
    const missing: Cosmetic = { ...cos('cosmetic.crown'), id: 'cosmetic.y', assetKey: 'does-not-exist', emoji: '🎩' };
    const html = render(<Character equipped={[noArt, missing]} character={char('character.fox')} />);
    expect(html).toContain('👑');
    expect(html).toContain('🎩');
    expect(html).not.toContain('cosmetic-art');
  });
  it('장식이 없으면 장식 그림도 없다', () => {
    expect(render(<Character character={char('character.fox')} />)).not.toContain('cosmetic-art');
  });
});

describe('Lab: 장식 그림 검증과 보존', () => {
  it('없는 그림 키는 오류, 그림도 이모지도 없으면 오류, 이모지만 있으면 주의', () => {
    const c = fresh();
    c.cosmetics[0].assetKey = 'dragon-hat';
    c.cosmetics[1].assetKey = undefined;
    c.cosmetics[1].emoji = '';
    c.cosmetics[2].assetKey = undefined; // 이모지는 있음
    const m = msgs(c);
    expect(m.some((x) => x.startsWith('error:cosmetic') && x.includes('"dragon-hat"'))).toBe(true);
    expect(m.some((x) => x.startsWith('error:cosmetic') && x.includes('그림 키나 이모지'))).toBe(true);
    expect(m.some((x) => x.startsWith('warning:cosmetic') && x.includes('이모지로 보여요'))).toBe(true);
  });
  it('캐릭터 보정값이 범위를 벗어나거나 숫자가 아니면 오류', () => {
    const c = fresh();
    c.characters[1].fit = { head: { dx: 500, dy: 0, s: 1 } };
    c.characters[2].fit = { face: { dx: 0, dy: 0, s: 5 } };
    c.characters[3].fit = { neck: { dx: Number.NaN, dy: 0, s: 1 } };
    const m = msgs(c).filter((x) => x.startsWith('error:character'));
    expect(m.filter((x) => x.includes('보정값')).length).toBe(3);
  });
  it('내보냈다가 다시 가져와도 그림 키와 보정값이 그대로다', () => {
    const r = parseImport(exportBundle(fresh()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content.cosmetics.map((c) => c.assetKey)).toEqual(content.cosmetics.map((c) => c.assetKey));
    expect(r.content.characters.find((c) => c.id === 'character.penguin')?.fit).toEqual(char('character.penguin').fit);
    expect(r.content.characters.find((c) => c.id === 'character.fox')?.fit).toBeUndefined();
  });
  it('예전 백업(그림 키/보정값 없음)도 읽는다', () => {
    const old = { countries: [], questions: [], badges: [], companions: [], characters: [{ id: 'character.a', nameKo: 'a', descriptionKo: '', assetKey: 'fox', status: 'verified' }], cosmetics: [{ id: 'cosmetic.a', nameKo: 'a', descriptionKo: '', slot: 'head', emoji: '🎩', cost: 1, status: 'verified' }] };
    const r = parseImport(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content.cosmetics[0].assetKey).toBeUndefined();
      expect(r.content.characters[0].fit).toBeUndefined();
    }
  });
  it('보정값에 모르는 슬롯/깨진 값이 섞여도 버리고 읽는다', () => {
    const bad = { countries: [], questions: [], badges: [], cosmetics: [], companions: [], characters: [{ id: 'c', nameKo: 'c', descriptionKo: '', assetKey: 'fox', status: 'draft', fit: { head: { dx: 1, dy: 2, s: 1 }, hair: { dx: 1, dy: 1, s: 1 }, face: { dx: 'x', dy: 0, s: 1 } } }] };
    const r = parseImport(JSON.stringify(bad));
    expect(r.ok && r.content.characters[0].fit).toEqual({ head: { dx: 1, dy: 2, s: 1 } });
  });
});
