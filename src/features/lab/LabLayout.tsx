import { useMemo, useState } from 'react';
import type { Content } from '../../data/content';
import { CountryEditor } from './CountryEditor';
import { DataPanel } from './DataPanel';
import { loadDraft, saveDraft } from './labStorage';
import { IssueList } from './labUi';
import { PlaytestPanel } from './PlaytestPanel';
import { QuestionEditor } from './QuestionEditor';
import { RewardEditor } from './RewardEditor';
import { hasErrors, validateContent, type ContentKind, type Issue } from './validators';
import './lab.css';

type Tab = 'countries' | 'questions' | 'rewards' | 'check' | 'data' | 'playtest';
type Focus = { tab: Tab; id: string; n: number } | null;

const KIND_TAB: Record<ContentKind, Tab> = { country: 'countries', question: 'questions', badge: 'rewards', cosmetic: 'rewards' };
const KIND_LABEL: Record<ContentKind, string> = { country: '국가', question: '문제', badge: '배지', cosmetic: '장식' };

export function LabLayout({ onExit }: { onExit: () => void }) {
  const [initial] = useState(() => loadDraft());
  const [content, setContent] = useState<Content>(initial.content);
  const [tab, setTab] = useState<Tab>('countries');
  const [focus, setFocus] = useState<Focus>(null);
  const [saveState, setSaveState] = useState<'saved' | 'failed'>('saved');
  const [notice, setNotice] = useState(initial.restored ? '이전에 편집하던 내용을 불러왔어요.' : '게임에 들어 있는 현재 데이터로 시작했어요.');

  const issues = useMemo(() => validateContent(content), [content]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.length - errorCount;

  // 편집할 때마다 브라우저에 임시 저장한다.
  const update = (next: Content) => {
    setContent(next);
    setSaveState(saveDraft(next) ? 'saved' : 'failed');
  };
  const replace = (next: Content, note: string) => {
    update(next);
    setNotice(note);
  };
  const go = (t: Tab, id?: string) => {
    setTab(t);
    setFocus(id ? { tab: t, id, n: Date.now() } : null);
  };
  const focusId = focus && focus.tab === tab ? focus.id : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'countries', label: `국가 (${content.countries.length})` },
    { id: 'questions', label: `문제 (${content.questions.length})` },
    { id: 'rewards', label: `보상 (${content.cosmetics.length + content.badges.length})` },
    { id: 'check', label: errorCount > 0 ? `검증 ❌${errorCount}` : warnCount > 0 ? `검증 ⚠️${warnCount}` : '검증 ✅' },
    { id: 'playtest', label: '플레이 테스트' },
    { id: 'data', label: '가져오기/내보내기' },
  ];

  return (
    <div className="lab">
      <header className="lab-header">
        <div>
          <h1>🧪 World Pals Lab</h1>
          <p className="lab-sub">콘텐츠 제작 도구 · 이 브라우저에서만 쓰는 로컬 편집기예요</p>
        </div>
        <div className="lab-header-right">
          <span className={`lab-save ${saveState}`} role="status">
            {saveState === 'saved' ? '💾 임시 저장됨' : '⚠️ 임시 저장 실패 — 백업 파일로 내려받아 주세요'}
          </span>
          <button type="button" className="lab-btn" onClick={onExit}>← 게임으로</button>
        </div>
      </header>
      {notice && (
        <p className="lab-note" role="status">
          {notice} <button type="button" className="lab-link" onClick={() => setNotice('')}>닫기</button>
        </p>
      )}

      <nav className="lab-tabs" role="tablist" aria-label="Lab 메뉴">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="lab-main">
        {tab === 'countries' && <CountryEditor key={`c-${focus?.n ?? 0}`} content={content} onChange={update} issues={issues} focusId={focusId} />}
        {tab === 'questions' && <QuestionEditor key={`q-${focus?.n ?? 0}`} content={content} onChange={update} issues={issues} focusId={focusId} />}
        {tab === 'rewards' && <RewardEditor key={`r-${focus?.n ?? 0}`} content={content} onChange={update} issues={issues} focusId={focusId} />}
        {tab === 'check' && <ValidationPanel issues={issues} onGo={(i) => go(KIND_TAB[i.kind], i.id)} />}
        {tab === 'playtest' && <PlaytestPanel content={content} />}
        {tab === 'data' && <DataPanel content={content} onReplace={replace} hasBlockingErrors={hasErrors(issues)} />}
      </main>
    </div>
  );
}

function ValidationPanel({ issues, onGo }: { issues: Issue[]; onGo: (i: Issue) => void }) {
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const errors = sorted.filter((i) => i.severity === 'error').length;
  return (
    <section className="lab-card">
      <h2>콘텐츠 검증</h2>
      <p>
        {errors > 0 ? `❌ 오류 ${errors}개를 고치면 게임 데이터로 내보낼 수 있어요.` : '✅ 오류가 없어요. 게임 데이터로 내보낼 수 있어요.'}
        {sorted.length - errors > 0 && ` (주의 ${sorted.length - errors}개는 내보내기를 막지 않아요)`}
      </p>
      {sorted.length === 0 ? (
        <IssueList issues={[]} />
      ) : (
        <ul className="lab-issues">
          {sorted.map((i, n) => (
            <li key={n} className={`issue-${i.severity}`}>
              <strong>{i.severity === 'error' ? '❌ 오류' : '⚠️ 주의'}</strong> [{KIND_LABEL[i.kind]} {i.id}] {i.message}{' '}
              <button type="button" className="lab-link" onClick={() => onGo(i)}>고치러 가기</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
