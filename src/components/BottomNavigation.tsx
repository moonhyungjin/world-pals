import type { ReactNode } from 'react';

export type NavTab = 'home' | 'passport' | 'map' | 'customize';

/** 24×24 선 아이콘. 색은 글자색(currentColor)을 따라가서 선택/기본 상태가 자동으로 바뀐다. */
const ICONS: Record<NavTab, ReactNode> = {
  home: (
    <>
      <path d="M3.5 11.2 12 4l8.5 7.2" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  passport: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <circle cx="12" cy="10.5" r="3" />
      <path d="M9.5 10.5h5M12 7.5c-1.2 1.6-1.2 4.4 0 6M12 7.5c1.2 1.6 1.2 4.4 0 6" />
      <path d="M8.5 17.2h7" />
    </>
  ),
  map: (
    <>
      <path d="M9 5 3.5 7v12.5L9 17.5l6 2 5.5-2V5L15 7 9 5Z" />
      <path d="M9 5v12.5M15 7v12.5" />
    </>
  ),
  customize: (
    <>
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
      <path d="M6.5 7h11a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <path d="M8 13.5h8M10 13.5v2.2h4v-2.2" />
    </>
  ),
};

const TABS: { id: NavTab; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'passport', label: '여권' },
  { id: 'map', label: '지도' },
  { id: 'customize', label: '꾸미기' },
];

export function BottomNavigation({ current, onChange }: { current: NavTab; onChange: (tab: NavTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="메뉴">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === current ? 'active' : ''}
          aria-current={t.id === current ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {ICONS[t.id]}
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
