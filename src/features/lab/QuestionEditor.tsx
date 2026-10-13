import { useEffect, useMemo, useState } from 'react';
import { QuestionCard } from '../../components/QuestionCard';
import type { Content } from '../../data/content';
import type { Question, QuestionType } from '../../types/question';
import { buildQuizItem } from '../quiz/quizEngine';
import { generateQuestionDraft, replaceById, uniqueId } from './labOps';
import { EntityList, Field, IssueList, StatusSelect, rowFlag } from './labUi';
import type { Issue } from './validators';

type Props = { content: Content; onChange: (c: Content) => void; issues: Issue[]; focusId?: string | null };

const TYPE_LABEL: Record<QuestionType, string> = { capital: '수도 맞히기', flag: '국기 고르기' };

export function QuestionEditor({ content, onChange, issues, focusId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? content.questions[0]?.id ?? null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const [genCountry, setGenCountry] = useState('');
  const [genType, setGenType] = useState<QuestionType>('capital');
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [previewSeed, setPreviewSeed] = useState(0);

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);
  useEffect(() => setPicked(null), [selectedId]);

  const nameOf = (id: string) => content.countries.find((c) => c.id === id)?.nameKo || id;
  const question = content.questions.find((q) => q.id === selectedId);
  const answerCountry = question && content.countries.find((c) => c.id === question.countryId);

  // 미리보기는 편집 중인 문제로 실제 게임과 같은 코드로 보기를 만든다.
  const previewItem = useMemo(
    () => (question && answerCountry ? buildQuizItem(question, content, Math.random) : null),
    [question, content.countries, previewSeed],
  );

  const patch = (changes: Partial<Question>) => {
    if (!question) return;
    const next = { ...question, ...changes };
    onChange({ ...content, questions: replaceById(content.questions, question.id, next) });
    if (changes.id !== undefined && changes.id !== question.id) {
      setFreshIds((f) => f.map((x) => (x === question.id ? next.id : x)));
      setSelectedId(next.id);
    }
  };

  const setDistractor = (index: number, id: string) => {
    if (!question) return;
    const list = [...question.distractorCountryIds];
    list[index] = id;
    patch({ distractorCountryIds: list });
  };

  const addBlank = () => {
    const first = content.countries[0]?.id ?? '';
    const q: Question = {
      id: uniqueId('q.capital.NEW', content.questions.map((x) => x.id)),
      type: 'capital',
      countryId: first,
      distractorCountryIds: content.countries.filter((c) => c.id !== first).slice(0, 3).map((c) => c.id),
      difficulty: 2,
      status: 'draft',
    };
    onChange({ ...content, questions: [q, ...content.questions] });
    setFreshIds((f) => [...f, q.id]);
    setSelectedId(q.id);
  };

  const generate = () => {
    const q = generateQuestionDraft(content, genCountry, genType);
    if (!q) {
      setMessage('초안을 만들 수 없어요. 국가를 고르고, 보기로 쓸 검수 완료 국가가 3개 이상 있는지 확인해 주세요.');
      return;
    }
    onChange({ ...content, questions: [q, ...content.questions] });
    setFreshIds((f) => [...f, q.id]);
    setSelectedId(q.id);
    setMessage(`"${q.id}" 초안을 만들었어요. 초안은 기본 출제에서 제외돼요.`);
  };

  const duplicate = () => {
    if (!question) return;
    const copy: Question = {
      ...question,
      id: uniqueId(`${question.id}_copy`, content.questions.map((x) => x.id)),
      distractorCountryIds: [...question.distractorCountryIds],
      status: 'draft',
    };
    onChange({ ...content, questions: [copy, ...content.questions] });
    setFreshIds((f) => [...f, copy.id]);
    setSelectedId(copy.id);
  };

  const remove = () => {
    if (!question || !window.confirm(`문제 "${question.id}"를 삭제할까요?`)) return;
    onChange({ ...content, questions: content.questions.filter((q) => q.id !== question.id) });
    setSelectedId(null);
  };

  const myIssues = question ? issues.filter((i) => i.kind === 'question' && i.id === question.id) : [];
  const countryOptions = content.countries.map((c) => (
    <option key={c.id} value={c.id}>{c.nameKo || '(이름 없음)'} ({c.id})</option>
  ));

  return (
    <div className="lab-split">
      <EntityList
        rows={content.questions.map((q) => ({
          id: q.id,
          title: `${nameOf(q.countryId)} · ${TYPE_LABEL[q.type] ?? q.type}`,
          sub: q.id,
          status: q.status,
          flagged: rowFlag(issues, 'question', q.id),
        }))}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setMessage(''); }}
      >
        <div className="lab-gen">
          <strong>국가에서 초안 만들기</strong>
          <select aria-label="초안을 만들 국가" value={genCountry} onChange={(e) => setGenCountry(e.target.value)}>
            <option value="">국가 선택</option>
            {countryOptions}
          </select>
          <select aria-label="문제 유형" value={genType} onChange={(e) => setGenType(e.target.value as QuestionType)}>
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <button type="button" className="lab-btn primary" onClick={generate} disabled={!genCountry}>초안 생성</button>
          <button type="button" className="lab-btn" onClick={addBlank} disabled={content.countries.length === 0}>＋ 빈 문제</button>
        </div>
        {message && <p className="lab-note" role="status">{message}</p>}
      </EntityList>

      {!question ? (
        <p className="lab-empty">왼쪽에서 문제를 고르거나 새로 만들어 주세요.</p>
      ) : (
        <div className="lab-form">
          <div className="lab-actions">
            <button type="button" className="lab-btn" onClick={duplicate}>복제</button>
            <button type="button" className="lab-btn danger" onClick={remove}>삭제</button>
          </div>
          <Field label="문제 ID" hint={freshIds.includes(question.id) ? '새 항목이라 지금만 바꿀 수 있어요.' : '저장된 문제의 ID는 바꿀 수 없어요 (오답 기록이 ID로 연결돼요).'}>
            <input value={question.id} readOnly={!freshIds.includes(question.id)} onChange={(e) => patch({ id: e.target.value.trim() })} />
          </Field>
          <Field label="문제 유형">
            <select value={question.type} onChange={(e) => patch({ type: e.target.value as QuestionType })}>
              {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="정답 국가">
            <select value={question.countryId} onChange={(e) => patch({ countryId: e.target.value })}>
              {!content.countries.some((c) => c.id === question.countryId) && <option value={question.countryId}>⚠️ 없는 국가 ({question.countryId})</option>}
              {countryOptions}
            </select>
          </Field>
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`오답 보기 ${i + 1}`}>
              <select value={question.distractorCountryIds[i] ?? ''} onChange={(e) => setDistractor(i, e.target.value)}>
                <option value="">(선택 안 함)</option>
                {question.distractorCountryIds[i] && !content.countries.some((c) => c.id === question.distractorCountryIds[i]) && (
                  <option value={question.distractorCountryIds[i]}>⚠️ 없는 국가 ({question.distractorCountryIds[i]})</option>
                )}
                {countryOptions}
              </select>
            </Field>
          ))}
          <Field label="힌트"><input value={question.hintKo ?? ''} onChange={(e) => patch({ hintKo: e.target.value })} /></Field>
          <Field label="해설 (비우면 국가의 지리 상식을 사용)">
            <textarea rows={2} value={question.explanationKo ?? ''} onChange={(e) => patch({ explanationKo: e.target.value })} />
          </Field>
          <div className="lab-row2">
            <Field label="난이도(출제 그룹)">
              <select value={question.difficulty} onChange={(e) => patch({ difficulty: Number(e.target.value) as Question['difficulty'] })}>
                <option value={1}>1 (쉬움 · 첫 플레이에 우선)</option>
                <option value={2}>2 (보통)</option>
                <option value={3}>3 (어려움)</option>
              </select>
            </Field>
            <Field label="검수 상태" hint="초안은 기본 출제에서 제외돼요."><StatusSelect value={question.status} onChange={(status) => patch({ status })} /></Field>
          </div>

          <h3>플레이 모드 미리보기</h3>
          {previewItem && answerCountry ? (
            <div className="lab-play-preview">
              <QuestionCard item={previewItem} country={answerCountry} content={content} selectedId={picked} onSelect={setPicked} />
              {previewItem.choices.length < 4 && <p className="lab-note">⚠️ 보기가 4개 미만이에요. 보기 설정을 확인해 주세요.</p>}
              {picked && (
                <p className="lab-note" role="status">
                  {picked === previewItem.countryId ? '⭕ 정답 처리돼요.' : '💡 오답 처리돼요.'}
                </p>
              )}
              <button type="button" className="lab-btn" onClick={() => { setPicked(null); setPreviewSeed((n) => n + 1); }}>
                다시 섞어서 풀어보기
              </button>
            </div>
          ) : (
            <p className="lab-empty">정답 국가를 먼저 고르면 미리보기가 나와요.</p>
          )}

          <h3>검증</h3>
          <IssueList issues={myIssues} />
        </div>
      )}
    </div>
  );
}
