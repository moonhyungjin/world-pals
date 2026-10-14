import { useEffect, useState } from 'react';
import { Character } from '../../components/Character';
import type { Content } from '../../data/content';
import type { PlayCharacter } from '../../types/character';
import { CHARACTER_ASSET_KEYS } from '../characters/characterAssets';
import { replaceById, uniqueId } from './labOps';
import { EntityList, Field, IssueList, StatusSelect, rowFlag } from './labUi';
import type { Issue } from './validators';

type Props = { content: Content; onChange: (c: Content) => void; issues: Issue[]; focusId?: string | null };

/** 플레이어가 고르는 주인공 캐릭터 편집기. 그림은 src/assets/characters/ 의 SVG 파일 이름(그림 키)으로 연결한다. */
export function CharacterEditor({ content, onChange, issues, focusId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? content.characters[0]?.id ?? null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  useEffect(() => {
    if (focusId && content.characters.some((c) => c.id === focusId)) setSelectedId(focusId);
  }, [focusId, content.characters]);

  const item = content.characters.find((c) => c.id === selectedId);
  const ids = () => content.characters.map((x) => x.id);

  const patch = (changes: Partial<PlayCharacter>) => {
    if (!item) return;
    const next = { ...item, ...changes };
    onChange({ ...content, characters: replaceById(content.characters, item.id, next) });
    if (changes.id !== undefined && changes.id !== item.id) {
      setFreshIds((f) => f.map((x) => (x === item.id ? next.id : x)));
      setSelectedId(next.id);
    }
  };
  const add = () => {
    const c: PlayCharacter = {
      id: uniqueId('character.new', ids()),
      nameKo: '',
      descriptionKo: '',
      assetKey: CHARACTER_ASSET_KEYS[0] ?? '',
      status: 'draft',
    };
    onChange({ ...content, characters: [c, ...content.characters] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };
  const duplicate = () => {
    if (!item) return;
    const c: PlayCharacter = { ...item, id: uniqueId(`${item.id}_copy`, ids()), status: 'draft' };
    onChange({ ...content, characters: [c, ...content.characters] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };
  const remove = () => {
    const label = item?.nameKo || item?.id;
    if (!item || !window.confirm(`캐릭터 "${label}"를 삭제할까요?\n이 캐릭터를 고른 플레이어는 첫 번째 캐릭터로 바뀌어 보여요.`)) return;
    onChange({ ...content, characters: content.characters.filter((c) => c.id !== item.id) });
    setSelectedId(null);
  };

  return (
    <div className="lab-split">
      <EntityList
        rows={content.characters.map((c) => ({
          id: c.id,
          title: c.nameKo,
          sub: `${c.assetKey} · ${c.id}`,
          status: c.status,
          flagged: rowFlag(issues, 'character', c.id),
        }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
      >
        <button type="button" className="lab-btn primary" onClick={add}>＋ 새 캐릭터</button>
      </EntityList>
      {!item ? (
        <p className="lab-empty">캐릭터를 고르거나 새로 만들어 주세요.</p>
      ) : (
        <div className="lab-form">
          <div className="lab-actions">
            <button type="button" className="lab-btn" onClick={duplicate}>복제</button>
            <button type="button" className="lab-btn danger" onClick={remove}>삭제</button>
          </div>
          <Field
            label="캐릭터 ID"
            hint={freshIds.includes(item.id) ? '새 항목이라 지금만 바꿀 수 있어요.' : '저장된 항목의 ID는 바꿀 수 없어요 (플레이어가 고른 캐릭터가 ID로 연결돼요).'}
          >
            <input value={item.id} readOnly={!freshIds.includes(item.id)} onChange={(e) => patch({ id: e.target.value.trim() })} />
          </Field>
          <Field label="이름"><input value={item.nameKo} onChange={(e) => patch({ nameKo: e.target.value })} /></Field>
          <Field label="소개 (짧게)"><input value={item.descriptionKo} onChange={(e) => patch({ descriptionKo: e.target.value })} /></Field>
          <Field label="그림 키" hint="src/assets/characters/ 폴더의 SVG 파일 이름이에요. 새 그림은 파일을 넣고 다시 빌드해야 목록에 나와요.">
            <select value={item.assetKey} onChange={(e) => patch({ assetKey: e.target.value })}>
              {!CHARACTER_ASSET_KEYS.includes(item.assetKey) && <option value={item.assetKey}>⚠️ 없는 그림 ({item.assetKey || '비어 있음'})</option>}
              {CHARACTER_ASSET_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field
            label="장식 위치 보정값"
            hint="캐릭터마다 얼굴 모양이 달라 모자/선글라스/목도리/배낭 위치를 조금씩 옮겨요. 값은 characters.json의 fit에서 직접 고쳐요 (이동 ±80 이내, 크기 0.3~2배)."
          >
            <input readOnly value={item.fit ? Object.entries(item.fit).map(([slot, f]) => `${slot}: 이동(${f.dx}, ${f.dy}) 크기 ${f.s}`).join(' · ') : '보정 없음'} />
          </Field>
          <Field label="검수 상태" hint="검수 완료만 플레이어가 고를 수 있어요.">
            <StatusSelect value={item.status} onChange={(status) => patch({ status })} />
          </Field>
          <h3>미리보기</h3>
          <div className="lab-preview">
            <Character size={96} character={item} />
            <div>
              <strong>{item.nameKo || '(이름)'}</strong>
              <p>{item.descriptionKo}</p>
            </div>
          </div>
          <h3>검증</h3>
          <IssueList issues={issues.filter((i) => i.kind === 'character' && i.id === item.id)} />
        </div>
      )}
    </div>
  );
}
