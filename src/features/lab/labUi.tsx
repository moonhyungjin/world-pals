import { useState, type ReactNode } from 'react';
import type { ContentStatus } from '../../types/country';
import type { Issue } from './validators';

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: '초안',
  review: '검수 중',
  verified: '검수 완료(사용)',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`lab-status status-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="lab-field">
      <span className="lab-field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function StatusSelect({ value, onChange }: { value: ContentStatus; onChange: (v: ContentStatus) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ContentStatus)}>
      {(Object.keys(STATUS_LABEL) as ContentStatus[]).map((s) => (
        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
      ))}
    </select>
  );
}

/** 입력 중에는 문자열로 두고, 유효한 숫자일 때만 값을 올린다. 빈 칸은 undefined. */
export function NumberInput({ value, onChange, step = 'any' }: { value: number | undefined; onChange: (v: number | undefined) => void; step?: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim();
        if (t === '') onChange(undefined);
        else if (Number.isFinite(Number(t))) onChange(Number(t));
      }}
      data-step={step}
    />
  );
}

export function IssueList({ issues, empty = '문제가 없어요 ✅' }: { issues: Issue[]; empty?: string }) {
  if (issues.length === 0) return <p className="lab-ok">{empty}</p>;
  return (
    <ul className="lab-issues">
      {issues.map((i, n) => (
        <li key={n} className={`issue-${i.severity}`}>
          <strong>{i.severity === 'error' ? '❌ 오류' : '⚠️ 주의'}</strong> {i.message}
        </li>
      ))}
    </ul>
  );
}

export type ListRow = { id: string; title: string; sub?: string; status: ContentStatus; flagged?: 'error' | 'warning' };

/** 검색/상태 필터가 있는 목록. 각 편집기가 공통으로 사용한다. */
export function EntityList({
  rows,
  selectedId,
  onSelect,
  children,
}: {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ContentStatus>('all');
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) => (status === 'all' || r.status === status) && (!q || `${r.id} ${r.title} ${r.sub ?? ''}`.toLowerCase().includes(q)),
  );
  return (
    <div className="lab-list">
      <div className="lab-list-tools">
        <input type="search" placeholder="검색 (이름, ID)" aria-label="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="상태 필터" value={status} onChange={(e) => setStatus(e.target.value as 'all' | ContentStatus)}>
          <option value="all">전체 상태</option>
          {(Object.keys(STATUS_LABEL) as ContentStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>
      {children}
      <p className="lab-count">{shown.length} / {rows.length}개</p>
      <ul>
        {shown.map((r) => (
          <li key={r.id}>
            <button type="button" className={`lab-row ${r.id === selectedId ? 'selected' : ''}`} onClick={() => onSelect(r.id)}>
              <span className="lab-row-title">
                {r.flagged === 'error' ? '❌ ' : r.flagged === 'warning' ? '⚠️ ' : ''}
                {r.title || '(이름 없음)'}
              </span>
              <span className="lab-row-sub">{r.sub ?? r.id}</span>
              <StatusBadge status={r.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function rowFlag(issues: Issue[], kind: Issue['kind'], id: string): ListRow['flagged'] {
  const mine = issues.filter((i) => i.kind === kind && i.id === id);
  if (mine.some((i) => i.severity === 'error')) return 'error';
  return mine.length > 0 ? 'warning' : undefined;
}
