import { content as builtIn, type Content } from '../../data/content';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { parseImport, exportBundle } from './importExport';

export type Snapshot = { id: string; label: string; savedAt: string; bundle: string };
const MAX_SNAPSHOTS = 10;

/** 게임에 들어 있는 현재 콘텐츠의 복사본 (편집 시작점). */
export function builtInContent(): Content {
  return structuredClone(builtIn);
}

/** 임시 저장된 초안을 읽는다. 없거나 깨졌으면 게임 콘텐츠로 시작한다. */
export function loadDraft(): { content: Content; restored: boolean } {
  try {
    const text = localStorage.getItem(STORAGE_KEYS.labDraft);
    if (text) {
      const r = parseImport(text);
      if (r.ok) return { content: r.content, restored: true };
    }
  } catch {
    // 저장소를 읽을 수 없으면 기본값 사용
  }
  return { content: builtInContent(), restored: false };
}

export function saveDraft(content: Content): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.labDraft, exportBundle(content));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.labDraft);
  } catch {
    // 무시
  }
}

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.labSnapshots) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (s): s is Snapshot =>
        typeof s?.id === 'string' && typeof s?.label === 'string' && typeof s?.savedAt === 'string' && typeof s?.bundle === 'string',
    );
  } catch {
    return [];
  }
}

function writeSnapshots(list: Snapshot[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.labSnapshots, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** 버전 사본을 만든다 (최대 10개, 오래된 것부터 삭제). */
export function addSnapshot(content: Content, label: string, now: Date = new Date()): { ok: boolean; snapshots: Snapshot[] } {
  const snap: Snapshot = {
    id: `snap-${now.getTime()}`,
    label: label.trim() || '이름 없는 사본',
    savedAt: now.toISOString(),
    bundle: exportBundle(content, now),
  };
  const next = [snap, ...loadSnapshots()].slice(0, MAX_SNAPSHOTS);
  return { ok: writeSnapshots(next), snapshots: next };
}

export function removeSnapshot(id: string): Snapshot[] {
  const next = loadSnapshots().filter((s) => s.id !== id);
  writeSnapshots(next);
  return next;
}
