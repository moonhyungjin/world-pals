/** 클립보드에 복사한다. 지원하지 않거나 막혀 있으면 false. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래의 예전 방식으로 다시 시도
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** 기기의 공유 창(모바일)을 열고, 없으면 복사로 대신한다. */
export async function shareOrCopy(data: { title: string; text: string; url?: string }): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'; // 사용자가 닫음
      // 그 밖의 오류는 복사로 대신
    }
  }
  const ok = await copyText(data.url ? `${data.text}\n${data.url}` : data.text);
  return ok ? 'copied' : 'failed';
}
