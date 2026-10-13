import { useEffect, useState } from 'react';
import { Flag } from '../../components/Flag';
import type { Content } from '../../data/content';
import type { Country } from '../../types/country';
import { deleteCountry, duplicateCountry, generateQuestionDraft, newCountry, questionsLinkedToCountry, replaceById } from './labOps';
import { EntityList, Field, IssueList, NumberInput, StatusSelect, rowFlag } from './labUi';
import type { Issue } from './validators';

type Props = { content: Content; onChange: (c: Content) => void; issues: Issue[]; focusId?: string | null };

export function CountryEditor({ content, onChange, issues, focusId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? content.countries[0]?.id ?? null);
  const [freshIds, setFreshIds] = useState<string[]>([]); // 이번에 새로 만든 항목만 ID를 바꿀 수 있다
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  const country = content.countries.find((c) => c.id === selectedId);
  const linked = country ? questionsLinkedToCountry(content, country.id) : undefined;
  const continents = [...new Set(content.countries.map((c) => c.continent).filter(Boolean))];

  const patch = (changes: Partial<Country>) => {
    if (!country) return;
    const next = { ...country, ...changes };
    if (changes.id !== undefined && changes.id !== country.id) {
      onChange({ ...content, countries: replaceById(content.countries, country.id, next) });
      setFreshIds((f) => f.map((x) => (x === country.id ? next.id : x)));
      setSelectedId(next.id);
    } else {
      onChange({ ...content, countries: replaceById(content.countries, country.id, next) });
    }
  };

  const add = () => {
    const c = newCountry(content);
    onChange({ ...content, countries: [c, ...content.countries] });
    setFreshIds((f) => [...f, c.id]);
    setSelectedId(c.id);
  };

  const duplicate = () => {
    if (!country) return;
    const dup = duplicateCountry(content, country.id);
    if (!dup) return;
    onChange({ ...content, countries: [dup, ...content.countries] });
    setFreshIds((f) => [...f, dup.id]);
    setSelectedId(dup.id);
  };

  const remove = () => {
    if (!country || !linked) return;
    const text =
      `"${country.nameKo || country.id}" 국가를 삭제할까요?\n` +
      `- 이 국가가 정답인 문제 ${linked.asAnswer.length}개도 함께 삭제돼요.\n` +
      `- 오답 보기로 쓰는 문제 ${linked.asDistractor.length}개는 남고, 검증에서 오류로 표시돼요.`;
    if (!window.confirm(text)) return;
    onChange(deleteCountry(content, country.id));
    setSelectedId(null);
  };

  const makeQuizDrafts = () => {
    if (!country) return;
    let next = content;
    let made = 0;
    for (const type of ['capital', 'flag'] as const) {
      if (next.questions.some((q) => q.countryId === country.id && q.type === type)) continue;
      const q = generateQuestionDraft(next, country.id, type);
      if (q) {
        next = { ...next, questions: [...next.questions, q] };
        made++;
      }
    }
    onChange(next);
    setMessage(
      made > 0
        ? `퀴즈 초안 ${made}개를 만들었어요. '문제' 탭에서 확인해 주세요. (초안 상태라 출제되지 않아요)`
        : '이미 두 유형의 문제가 있거나, 보기로 쓸 검수 완료 국가가 부족해요.',
    );
  };

  const myIssues = country ? issues.filter((i) => i.kind === 'country' && i.id === country.id) : [];
  const idOk = country && /^[A-Za-z]{2}$/.test(country.id);

  return (
    <div className="lab-split">
      <EntityList
        rows={content.countries.map((c) => ({
          id: c.id,
          title: c.nameKo,
          sub: `${c.id} · ${c.capitalKo || '수도 없음'}`,
          status: c.status,
          flagged: rowFlag(issues, 'country', c.id),
        }))}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setMessage(''); }}
      >
        <button type="button" className="lab-btn primary" onClick={add}>＋ 새 국가</button>
      </EntityList>

      {!country ? (
        <p className="lab-empty">왼쪽에서 국가를 고르거나 새로 만들어 주세요.</p>
      ) : (
        <div className="lab-form">
          <div className="lab-actions">
            <button type="button" className="lab-btn" onClick={duplicate}>복제</button>
            <button type="button" className="lab-btn danger" onClick={remove}>삭제</button>
            <button type="button" className="lab-btn" onClick={makeQuizDrafts}>기본 퀴즈 초안 만들기</button>
          </div>
          {message && <p className="lab-note" role="status">{message}</p>}

          <Field label="국가 ID" hint={freshIds.includes(country.id) ? '새 항목이라 지금만 바꿀 수 있어요. 2글자 ISO 코드(예: KR)를 쓰면 국기가 표시돼요.' : '저장된 항목의 ID는 바꿀 수 없어요 (진행 기록과 문제가 ID로 연결돼요).'}>
            <input value={country.id} readOnly={!freshIds.includes(country.id)} onChange={(e) => patch({ id: e.target.value.trim().toUpperCase() })} />
          </Field>
          <Field label="국가명(한국어)"><input value={country.nameKo} onChange={(e) => patch({ nameKo: e.target.value })} /></Field>
          <Field label="수도명"><input value={country.capitalKo} onChange={(e) => patch({ capitalKo: e.target.value })} /></Field>
          <Field label="대륙">
            <input list="lab-continents" value={country.continent} onChange={(e) => patch({ continent: e.target.value })} />
            <datalist id="lab-continents">{continents.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <div className="lab-row2">
            <Field label="위도"><NumberInput key={`lat-${country.id}`} value={country.latitude} onChange={(v) => patch({ latitude: v })} /></Field>
            <Field label="경도"><NumberInput key={`lon-${country.id}`} value={country.longitude} onChange={(v) => patch({ longitude: v })} /></Field>
          </div>
          <Field label="국기 리소스 키(이모지 등, 보조)"><input value={country.flag} onChange={(e) => patch({ flag: e.target.value })} /></Field>
          <Field label="어린이용 지리 상식"><textarea rows={3} value={country.factKo} onChange={(e) => patch({ factKo: e.target.value })} /></Field>
          <Field label="별칭/허용 표기 (쉼표로 구분)">
            <input value={(country.aliases ?? []).join(', ')} onChange={(e) => patch({ aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="검수 상태" hint="검수 완료(verified)만 게임에 출제돼요."><StatusSelect value={country.status} onChange={(status) => patch({ status })} /></Field>
          <Field label="데이터 출처 메모"><textarea rows={2} value={country.sourceNote ?? ''} onChange={(e) => patch({ sourceNote: e.target.value })} /></Field>

          <h3>미리보기</h3>
          <div className="lab-preview">
            {idOk ? <Flag country={country} className="big-flag" /> : <span className="lab-noflag">🏳️ 국기 없음</span>}
            <div>
              <strong>{country.nameKo || '(국가명)'}</strong>
              <p>수도: {country.capitalKo || '?'} · {country.continent || '대륙 미정'}</p>
              <p>{country.factKo}</p>
            </div>
          </div>

          <h3>연결된 문제</h3>
          {linked && (
            <ul className="lab-links">
              <li>정답으로 쓰는 문제 {linked.asAnswer.length}개{linked.asAnswer.length > 0 && `: ${linked.asAnswer.map((q) => q.id).join(', ')}`}</li>
              <li>오답 보기로 쓰는 문제 {linked.asDistractor.length}개</li>
              <li>이 국가를 대상으로 하는 보상: 도장(국가 발견 시 자동 지급) · 배지 조건에 쓰이는 대륙 "{country.continent || '-'}"</li>
            </ul>
          )}

          <h3>검증</h3>
          <IssueList issues={myIssues} />
        </div>
      )}
    </div>
  );
}
