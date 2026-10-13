import { useEffect, useState } from 'react';
import { Character } from '../../components/Character';
import type { Content } from '../../data/content';
import type { Companion } from '../../types/companion';
import { replaceById, uniqueId } from './labOps';
import { EntityList, Field, IssueList, StatusSelect, rowFlag } from './labUi';
import type { Issue } from './validators';

type Props = { content: Content; onChange: (c: Content) => void; issues: Issue[]; focusId?: string | null };

/** 나라별 탐험 친구(동물) 편집기. 플레이어는 연결된 나라의 도장을 받으면 이 친구를 만난다. */
export function CompanionEditor({ content, onChange, issues, focusId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? content.companions[0]?.id ?? null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  useEffect(() => {
    if (focusId && content.companions.some((c) => c.id === focusId)) setSelectedId(focusId);
  }, [focusId, content.companions]);

  const item = content.companions.find((c) => c.id === selectedId);
  const countryName = (id: string) => content.countries.find((c) => c.id === id)?.nameKo || id;
  const ids = () => content.companions.map((x) => x.id);

  const patch = (changes: Partial<Companion>) => {
    if (!item) return;
    const next = { ...item, ...changes };
    onChange({ ...content, companions: replaceById(content.companions, item.id, next) });
    if (changes.id !== undefined && changes.id !== item.id) {
      setFreshIds((f) => f.map((x) => (x === item.id ? next.id : x)));
      setSelectedId(next.id);
    }
  };
  const add = () => {
    const c: Companion = {
      id: uniqueId('companion.new', ids()),
      countryId: content.countries[0]?.id ?? '',
      nameKo: '',
      emoji: '',
      descriptionKo: '',
      status: 'draft',
      sourceNote: '',
    };
    onChange({ ...content, companions: [c, ...content.companions] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };
  const duplicate = () => {
    if (!item) return;
    const c: Companion = { ...item, id: uniqueId(`${item.id}_copy`, ids()), status: 'draft' };
    onChange({ ...content, companions: [c, ...content.companions] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };
  const remove = () => {
    const label = item?.nameKo || item?.id;
    if (!item || !window.confirm(`탐험 친구 "${label}"를 삭제할까요?\n이 친구와 함께 다니던 플레이어는 친구가 없는 상태로 돌아가요.`)) return;
    onChange({ ...content, companions: content.companions.filter((c) => c.id !== item.id) });
    setSelectedId(null);
  };

  return (
    <div className="lab-split">
      <EntityList
        rows={content.companions.map((c) => ({
          id: c.id,
          title: `${c.emoji} ${c.nameKo}`,
          sub: `${countryName(c.countryId)} · ${c.id}`,
          status: c.status,
          flagged: rowFlag(issues, 'companion', c.id),
        }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
      >
        <button type="button" className="lab-btn primary" onClick={add}>＋ 새 탐험 친구</button>
      </EntityList>
      {!item ? (
        <p className="lab-empty">탐험 친구를 고르거나 새로 만들어 주세요.</p>
      ) : (
        <div className="lab-form">
          <div className="lab-actions">
            <button type="button" className="lab-btn" onClick={duplicate}>복제</button>
            <button type="button" className="lab-btn danger" onClick={remove}>삭제</button>
          </div>
          <Field
            label="친구 ID"
            hint={freshIds.includes(item.id) ? '새 항목이라 지금만 바꿀 수 있어요.' : '저장된 항목의 ID는 바꿀 수 없어요 (플레이어가 함께 다니는 친구가 ID로 연결돼요).'}
          >
            <input value={item.id} readOnly={!freshIds.includes(item.id)} onChange={(e) => patch({ id: e.target.value.trim() })} />
          </Field>
          <Field label="만나는 나라" hint="이 나라의 도장을 받으면 이 친구를 만나요.">
            <select value={item.countryId} onChange={(e) => patch({ countryId: e.target.value })}>
              {!content.countries.some((c) => c.id === item.countryId) && (
                <option value={item.countryId}>⚠️ 없는 국가 ({item.countryId})</option>
              )}
              {content.countries.map((c) => (
                <option key={c.id} value={c.id}>{c.nameKo || '(이름 없음)'} ({c.id})</option>
              ))}
            </select>
          </Field>
          <div className="lab-row2">
            <Field label="이름"><input value={item.nameKo} onChange={(e) => patch({ nameKo: e.target.value })} /></Field>
            <Field label="이미지/에셋 키 (이모지)"><input value={item.emoji} onChange={(e) => patch({ emoji: e.target.value })} /></Field>
          </div>
          <Field label="어린이용 설명 (사실만, 짧게)">
            <textarea rows={2} value={item.descriptionKo} onChange={(e) => patch({ descriptionKo: e.target.value })} />
          </Field>
          <Field label="출처/근거 메모 (공식 국가동물인지 등)">
            <textarea rows={2} value={item.sourceNote ?? ''} onChange={(e) => patch({ sourceNote: e.target.value })} />
          </Field>
          <Field label="검수 상태" hint="검수 완료만 게임에서 만날 수 있어요.">
            <StatusSelect value={item.status} onChange={(status) => patch({ status })} />
          </Field>
          <h3>미리보기</h3>
          <div className="lab-preview">
            <Character size={96} companion={item} />
            <div>
              <strong>{item.emoji} {item.nameKo || '(이름)'}</strong>
              <p>{countryName(item.countryId)}에서 만나요</p>
              <p>{item.descriptionKo}</p>
            </div>
          </div>
          <h3>검증</h3>
          <IssueList issues={issues.filter((i) => i.kind === 'companion' && i.id === item.id)} />
        </div>
      )}
    </div>
  );
}
