import { useState } from 'react';
import type { Content } from '../../data/content';
import { downloadText, exportBundle, gameDataFiles, parseImport, timestampForFile } from './importExport';
import { addSnapshot, builtInContent, loadSnapshots, removeSnapshot, type Snapshot } from './labStorage';
import { IssueList } from './labUi';
import { hasErrors, validateContent } from './validators';

type Props = { content: Content; onReplace: (c: Content, note: string) => void; hasBlockingErrors: boolean };

export function DataPanel({ content, onReplace, hasBlockingErrors }: Props) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ content: Content; notes: string[] } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => loadSnapshots());
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');

  const readText = (t: string) => {
    const r = parseImport(t);
    if (r.ok) {
      setPreview({ content: r.content, notes: r.notes });
      setErrors([]);
    } else {
      setPreview(null);
      setErrors(r.errors);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const t = await file.text();
      setText(t);
      readText(t);
    } catch {
      setPreview(null);
      setErrors(['파일을 읽을 수 없어요.']);
    }
  };

  const apply = () => {
    if (!preview) return;
    if (!window.confirm('지금 편집 중인 내용이 가져온 내용으로 바뀌어요.\n먼저 버전 사본을 만들어 두는 것을 권장해요. 계속할까요?')) return;
    onReplace(preview.content, '가져온 내용을 적용했어요.');
    setPreview(null);
    setText('');
  };

  const exportGameFiles = () => {
    const stamp = timestampForFile();
    gameDataFiles(content).forEach((f, i) => setTimeout(() => downloadText(f.name, f.text), i * 250));
    setMessage(`게임 데이터 파일 5개를 내려받아요 (${stamp}). src/data/ 폴더의 같은 이름 파일을 교체해 주세요.`);
  };

  const makeSnapshot = () => {
    const r = addSnapshot(content, label);
    setSnapshots(r.snapshots);
    setLabel('');
    setMessage(r.ok ? '버전 사본을 만들었어요.' : '⚠️ 브라우저 저장 공간이 부족해서 사본을 저장하지 못했어요. 백업 파일로 내려받아 주세요.');
  };

  const restore = (s: Snapshot) => {
    const r = parseImport(s.bundle);
    if (!r.ok) {
      setMessage('이 사본을 읽을 수 없어요.');
      return;
    }
    if (window.confirm(`"${s.label}" 사본으로 되돌릴까요? 지금 편집 중인 내용은 바뀌어요.`)) onReplace(r.content, `"${s.label}" 사본으로 되돌렸어요.`);
  };

  const previewIssues = preview ? validateContent(preview.content) : [];

  return (
    <div className="lab-data">
      <section className="lab-card">
        <h3>내보내기</h3>
        <p className="lab-note">
          <strong>백업 파일</strong>은 오류가 있어도 내려받을 수 있어요(작업 보존용). <strong>게임 데이터 파일</strong>은 검증 오류가 없을 때만 내려받을 수 있어요.
        </p>
        <div className="lab-actions">
          <button type="button" className="lab-btn primary" onClick={() => downloadText(`world-pals-content-${timestampForFile()}.json`, exportBundle(content))}>
            백업 파일(JSON 1개) 내려받기
          </button>
          <button type="button" className="lab-btn" disabled={hasBlockingErrors} onClick={exportGameFiles}>
            게임 데이터 파일 5개 내려받기
          </button>
        </div>
        {hasBlockingErrors && <p className="lab-note error">❌ 검증 오류가 있어서 게임 데이터 파일은 내보낼 수 없어요. '검증' 탭에서 오류를 먼저 고쳐 주세요.</p>}
        <details>
          <summary>게임에 반영하는 방법</summary>
          <ol>
            <li>'게임 데이터 파일 5개'를 내려받아요.</li>
            <li>프로젝트의 <code>src/data/</code> 에서 같은 이름의 파일(countries, questions, badges, rewards, companions)을 교체해요.</li>
            <li><code>npm test</code> 와 <code>npm run build</code> 로 확인한 뒤 배포해요. 교체 전 아래 '버전 사본'을 만들어 두면 안전해요.</li>
          </ol>
        </details>
        {message && <p className="lab-note" role="status">{message}</p>}
      </section>

      <section className="lab-card">
        <h3>가져오기</h3>
        <p className="lab-note">Lab에서 내보낸 백업 파일(JSON)을 읽어요. 잘못된 파일이어도 앱은 멈추지 않고 이유를 알려줘요.</p>
        <input type="file" accept="application/json,.json" aria-label="JSON 파일 선택" onChange={(e) => onFile(e.target.files?.[0])} />
        <textarea rows={5} placeholder="또는 여기에 JSON을 붙여넣으세요" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="lab-actions">
          <button type="button" className="lab-btn" disabled={!text.trim()} onClick={() => readText(text)}>내용 확인</button>
        </div>
        {errors.length > 0 && (
          <ul className="lab-issues">{errors.map((e, i) => <li key={i} className="issue-error"><strong>❌ 가져올 수 없어요</strong> {e}</li>)}</ul>
        )}
        {preview && (
          <div className="lab-note">
            <p>✅ {preview.notes.join(' ')}</p>
            <p>{hasErrors(previewIssues) ? '⚠️ 가져온 내용에 검증 오류가 있어요. 적용 후 검증 탭에서 고칠 수 있어요.' : '검증 오류는 없어요.'}</p>
            <IssueList issues={previewIssues.filter((i) => i.severity === 'error').slice(0, 5)} empty="" />
            <button type="button" className="lab-btn primary" onClick={apply}>이 내용으로 편집 시작</button>
          </div>
        )}
      </section>

      <section className="lab-card">
        <h3>버전 사본 (백업)</h3>
        <p className="lab-note">이 브라우저 안에 최대 10개까지 보관돼요. 브라우저 데이터를 지우면 사라지니 중요한 건 백업 파일로도 내려받아 두세요.</p>
        <div className="lab-actions">
          <input placeholder="사본 이름 (예: 반영 전)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="사본 이름" />
          <button type="button" className="lab-btn primary" onClick={makeSnapshot}>사본 만들기</button>
        </div>
        <ul className="lab-snaps">
          {snapshots.length === 0 && <li className="lab-empty">아직 사본이 없어요.</li>}
          {snapshots.map((s) => (
            <li key={s.id}>
              <span><strong>{s.label}</strong> <small>{new Date(s.savedAt).toLocaleString('ko-KR')}</small></span>
              <span className="lab-actions">
                <button type="button" className="lab-btn" onClick={() => restore(s)}>되돌리기</button>
                <button type="button" className="lab-btn" onClick={() => downloadText(`world-pals-snapshot-${s.id}.json`, s.bundle)}>내려받기</button>
                <button type="button" className="lab-btn danger" onClick={() => setSnapshots(removeSnapshot(s.id))}>삭제</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lab-card">
        <h3>처음 상태로</h3>
        <p className="lab-note">편집 중인 내용을 버리고 게임에 들어 있는 현재 데이터로 되돌려요.</p>
        <button type="button" className="lab-btn danger" onClick={() => window.confirm('편집 중인 내용이 모두 사라져요. 계속할까요?') && onReplace(builtInContent(), '게임 원본 데이터로 되돌렸어요.')}>
          게임 원본으로 되돌리기
        </button>
      </section>
    </div>
  );
}
