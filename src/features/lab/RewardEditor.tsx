import { useEffect, useState } from 'react';
import { Character } from '../../components/Character';
import type { Content } from '../../data/content';
import type { Badge, BadgeCondition, Cosmetic, CosmeticSlot } from '../../types/reward';
import { replaceById, uniqueId } from './labOps';
import { EntityList, Field, IssueList, StatusSelect, rowFlag } from './labUi';
import type { Issue } from './validators';

type Props = { content: Content; onChange: (c: Content) => void; issues: Issue[]; focusId?: string | null };

const SLOT_LABEL: Record<CosmeticSlot, string> = { head: '머리', face: '얼굴', neck: '목', back: '등' };
const CONDITION_LABEL: Record<BadgeCondition['type'], string> = {
  sessionsCompleted: '오늘의 탐험을 N번 완료',
  countriesDiscovered: '나라를 N개 발견',
  continentDiscovered: '특정 대륙 나라를 N개 발견',
  questionsAnswered: '문제를 N개 풀기',
  reviewCorrect: '오답 복습 문제를 N번 맞히기',
};

export function RewardEditor({ content, onChange, issues, focusId }: Props) {
  const [kind, setKind] = useState<'cosmetic' | 'badge'>('cosmetic');
  useEffect(() => {
    if (focusId) setKind(content.badges.some((b) => b.id === focusId) ? 'badge' : 'cosmetic');
  }, [focusId, content.badges]);

  return (
    <div>
      <div className="lab-subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'cosmetic'} className={kind === 'cosmetic' ? 'active' : ''} onClick={() => setKind('cosmetic')}>
          캐릭터 장식 ({content.cosmetics.length})
        </button>
        <button type="button" role="tab" aria-selected={kind === 'badge'} className={kind === 'badge' ? 'active' : ''} onClick={() => setKind('badge')}>
          배지 ({content.badges.length})
        </button>
      </div>
      <p className="lab-note">
        별은 설정값(<code>src/config.ts</code>)으로, 국가 도장은 국가 발견 시 자동으로 지급돼요. 여기서는 장식과 배지를 편집해요.
      </p>
      {kind === 'cosmetic' ? (
        <CosmeticEditor content={content} onChange={onChange} issues={issues} focusId={focusId} />
      ) : (
        <BadgeEditor content={content} onChange={onChange} issues={issues} focusId={focusId} />
      )}
    </div>
  );
}

function CosmeticEditor({ content, onChange, issues, focusId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? content.cosmetics[0]?.id ?? null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  useEffect(() => {
    if (focusId && content.cosmetics.some((c) => c.id === focusId)) setSelectedId(focusId);
  }, [focusId, content.cosmetics]);

  const item = content.cosmetics.find((c) => c.id === selectedId);
  const patch = (changes: Partial<Cosmetic>) => {
    if (!item) return;
    const next = { ...item, ...changes };
    onChange({ ...content, cosmetics: replaceById(content.cosmetics, item.id, next) });
    if (changes.id !== undefined && changes.id !== item.id) {
      setFreshIds((f) => f.map((x) => (x === item.id ? next.id : x)));
      setSelectedId(next.id);
    }
  };
  const add = () => {
    const c: Cosmetic = {
      id: uniqueId('cosmetic.new', [...content.cosmetics.map((x) => x.id), ...content.badges.map((b) => b.id)]),
      nameKo: '', descriptionKo: '', slot: 'head', emoji: '', cost: 5, status: 'draft',
    };
    onChange({ ...content, cosmetics: [c, ...content.cosmetics] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };
  const duplicate = () => {
    if (!item) return;
    const c = { ...item, id: uniqueId(`${item.id}_copy`, [...content.cosmetics.map((x) => x.id), ...content.badges.map((b) => b.id)]), status: 'draft' as const };
    onChange({ ...content, cosmetics: [c, ...content.cosmetics] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };
  const remove = () => {
    if (!item || !window.confirm(`장식 "${item.nameKo || item.id}"를 삭제할까요?\n이미 해금한 플레이어 기록은 남지만 게임에서 보이지 않게 돼요.`)) return;
    onChange({ ...content, cosmetics: content.cosmetics.filter((c) => c.id !== item.id) });
    setSelectedId(null);
  };

  return (
    <div className="lab-split">
      <EntityList
        rows={content.cosmetics.map((c) => ({ id: c.id, title: `${c.emoji} ${c.nameKo}`, sub: `${SLOT_LABEL[c.slot] ?? c.slot} · ⭐${c.cost}`, status: c.status, flagged: rowFlag(issues, 'cosmetic', c.id) }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
      >
        <button type="button" className="lab-btn primary" onClick={add}>＋ 새 장식</button>
      </EntityList>
      {!item ? (
        <p className="lab-empty">장식을 고르거나 새로 만들어 주세요.</p>
      ) : (
        <div className="lab-form">
          <div className="lab-actions">
            <button type="button" className="lab-btn" onClick={duplicate}>복제</button>
            <button type="button" className="lab-btn danger" onClick={remove}>삭제</button>
          </div>
          <Field label="보상 ID" hint={freshIds.includes(item.id) ? '새 항목이라 지금만 바꿀 수 있어요.' : '저장된 항목의 ID는 바꿀 수 없어요 (해금 기록이 ID로 연결돼요).'}>
            <input value={item.id} readOnly={!freshIds.includes(item.id)} onChange={(e) => patch({ id: e.target.value.trim() })} />
          </Field>
          <Field label="표시 이름"><input value={item.nameKo} onChange={(e) => patch({ nameKo: e.target.value })} /></Field>
          <Field label="설명"><input value={item.descriptionKo} onChange={(e) => patch({ descriptionKo: e.target.value })} /></Field>
          <div className="lab-row2">
            <Field label="장착 위치">
              <select value={item.slot} onChange={(e) => patch({ slot: e.target.value as CosmeticSlot })}>
                {(Object.keys(SLOT_LABEL) as CosmeticSlot[]).map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="이미지/에셋 키 (이모지)"><input value={item.emoji} onChange={(e) => patch({ emoji: e.target.value })} /></Field>
          </div>
          <div className="lab-row2">
            <Field label="비용(별)" hint="해금 조건: 별을 사용해 해금">
              <input type="number" min={0} step={1} value={item.cost} onChange={(e) => patch({ cost: Number(e.target.value || 0) })} />
            </Field>
            <Field label="상태" hint="검수 완료만 꾸미기 화면에 나와요."><StatusSelect value={item.status} onChange={(status) => patch({ status })} /></Field>
          </div>
          <h3>미리보기</h3>
          <div className="lab-preview"><Character size={96} equipped={[item]} /><p>{item.nameKo || '(이름)'} · {SLOT_LABEL[item.slot]} · ⭐ {item.cost}</p></div>
          <h3>검증</h3>
          <IssueList issues={issues.filter((i) => i.kind === 'cosmetic' && i.id === item.id)} />
        </div>
      )}
    </div>
  );
}

function BadgeEditor({ content, onChange, issues, focusId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? content.badges[0]?.id ?? null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  useEffect(() => {
    if (focusId && content.badges.some((b) => b.id === focusId)) setSelectedId(focusId);
  }, [focusId, content.badges]);

  const badge = content.badges.find((b) => b.id === selectedId);
  const continents = [...new Set(content.countries.map((c) => c.continent).filter(Boolean))];
  const allIds = () => [...content.cosmetics.map((x) => x.id), ...content.badges.map((b) => b.id)];

  const patch = (changes: Partial<Badge>) => {
    if (!badge) return;
    const next = { ...badge, ...changes };
    onChange({ ...content, badges: replaceById(content.badges, badge.id, next) });
    if (changes.id !== undefined && changes.id !== badge.id) {
      setFreshIds((f) => f.map((x) => (x === badge.id ? next.id : x)));
      setSelectedId(next.id);
    }
  };
  const setConditionType = (type: BadgeCondition['type']) => {
    const count = badge?.condition.count ?? 1;
    patch({ condition: type === 'continentDiscovered' ? { type, continent: continents[0] ?? '', count } : { type, count } });
  };
  const add = () => {
    const b: Badge = { id: uniqueId('badge.new', allIds()), nameKo: '', descriptionKo: '', emoji: '', condition: { type: 'countriesDiscovered', count: 1 }, status: 'draft' };
    onChange({ ...content, badges: [b, ...content.badges] });
    setFreshIds((f) => [...f, b.id]);
    setSelectedId(b.id);
  };
  const duplicate = () => {
    if (!badge) return;
    const b = { ...badge, id: uniqueId(`${badge.id}_copy`, allIds()), status: 'draft' as const };
    onChange({ ...content, badges: [b, ...content.badges] });
    setFreshIds((f) => [...f, b.id]);
    setSelectedId(b.id);
  };
  const remove = () => {
    if (!badge || !window.confirm(`배지 "${badge.nameKo || badge.id}"를 삭제할까요?`)) return;
    onChange({ ...content, badges: content.badges.filter((b) => b.id !== badge.id) });
    setSelectedId(null);
  };

  return (
    <div className="lab-split">
      <EntityList
        rows={content.badges.map((b) => ({ id: b.id, title: `${b.emoji} ${b.nameKo}`, sub: b.id, status: b.status, flagged: rowFlag(issues, 'badge', b.id) }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
      >
        <button type="button" className="lab-btn primary" onClick={add}>＋ 새 배지</button>
      </EntityList>
      {!badge ? (
        <p className="lab-empty">배지를 고르거나 새로 만들어 주세요.</p>
      ) : (
        <div className="lab-form">
          <div className="lab-actions">
            <button type="button" className="lab-btn" onClick={duplicate}>복제</button>
            <button type="button" className="lab-btn danger" onClick={remove}>삭제</button>
          </div>
          <Field label="보상 ID" hint={freshIds.includes(badge.id) ? '새 항목이라 지금만 바꿀 수 있어요.' : '저장된 항목의 ID는 바꿀 수 없어요 (획득 기록이 ID로 연결돼요).'}>
            <input value={badge.id} readOnly={!freshIds.includes(badge.id)} onChange={(e) => patch({ id: e.target.value.trim() })} />
          </Field>
          <Field label="표시 이름"><input value={badge.nameKo} onChange={(e) => patch({ nameKo: e.target.value })} /></Field>
          <Field label="설명"><input value={badge.descriptionKo} onChange={(e) => patch({ descriptionKo: e.target.value })} /></Field>
          <Field label="이미지/에셋 키 (이모지)"><input value={badge.emoji} onChange={(e) => patch({ emoji: e.target.value })} /></Field>
          <Field label="해금 조건">
            <select value={badge.condition.type} onChange={(e) => setConditionType(e.target.value as BadgeCondition['type'])}>
              {(Object.keys(CONDITION_LABEL) as BadgeCondition['type'][]).map((t) => <option key={t} value={t}>{CONDITION_LABEL[t]}</option>)}
            </select>
          </Field>
          <div className="lab-row2">
            {badge.condition.type === 'continentDiscovered' && (
              <Field label="대륙">
                <input list="lab-badge-continents" value={badge.condition.continent} onChange={(e) => patch({ condition: { type: 'continentDiscovered', continent: e.target.value, count: badge.condition.count } })} />
                <datalist id="lab-badge-continents">{continents.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            )}
            <Field label="개수(N)">
              <input type="number" min={1} step={1} value={badge.condition.count} onChange={(e) => patch({ condition: { ...badge.condition, count: Number(e.target.value || 1) } as BadgeCondition })} />
            </Field>
          </div>
          <Field label="상태" hint="검수 완료 배지만 지급돼요."><StatusSelect value={badge.status} onChange={(status) => patch({ status })} /></Field>
          <h3>미리보기</h3>
          <div className="lab-preview">
            <span className="lab-badge-big" aria-hidden="true">{badge.emoji || '🏅'}</span>
            <div><strong>{badge.nameKo || '(이름)'}</strong><p>{badge.descriptionKo}</p><p className="hint">{CONDITION_LABEL[badge.condition.type].replace('N', String(badge.condition.count))}</p></div>
          </div>
          <h3>검증</h3>
          <IssueList issues={issues.filter((i) => i.kind === 'badge' && i.id === badge.id)} />
        </div>
      )}
    </div>
  );
}
