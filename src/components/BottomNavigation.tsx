export type NavTab = 'home' | 'passport' | 'map' | 'customize';

const TABS: { id: NavTab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'passport', icon: '🛂', label: '여권' },
  { id: 'map', icon: '🗺️', label: '지도' },
  { id: 'customize', icon: '🎒', label: '꾸미기' },
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
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
