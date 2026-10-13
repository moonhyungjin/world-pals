import { useState } from 'react';
import { CountryDetail } from '../../components/CountryDetail';
import { Flag } from '../../components/Flag';
import type { Content } from '../../data/content';
import type { PlayerProgress } from '../../types/progress';

/** 여권: 모든 출제 대상 국가를 대륙별로 보여주고, 발견한 나라는 도장 등급과 상세 정보를 보여준다. */
export function PassportPage({ progress, content }: { progress: PlayerProgress; content: Content }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const countries = content.countries.filter((c) => c.status === 'verified');
  const continents = [...new Set(countries.map((c) => c.continent))];
  const found = countries.filter((c) => progress.stampTiers[c.id]).length;
  const selected = countries.find((c) => c.id === selectedId);
  const tierOf = (id: string) => progress.stampTiers[id];

  return (
    <div className="passport">
      <h1>🛂 내 여권</h1>
      <p className="score">
        <strong>{found}</strong> / {countries.length}개 나라 발견
      </p>
      <div className="progress-bar" aria-hidden="true">
        <div style={{ width: `${countries.length ? (found / countries.length) * 100 : 0}%` }} />
      </div>

      {selected && <CountryDetail country={selected} tier={tierOf(selected.id)} onClose={() => setSelectedId(null)} />}

      {continents.map((continent) => (
        <section key={continent}>
          <h2 className="continent">{continent}</h2>
          <ul className="passport-grid">
            {countries
              .filter((c) => c.continent === continent)
              .map((c) => {
                const tier = tierOf(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`passport-cell ${tier ? `has-${tier}` : 'locked'}`}
                      aria-pressed={selectedId === c.id}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <Flag country={c} />
                      <span className="cell-name">{tier ? c.nameKo : '???'}</span>
                      <span className="cell-tier" aria-hidden="true">{tier === 'gold' ? '✨' : tier ? '●' : '🔒'}</span>
                      <span className="sr-only">
                        {c.nameKo}, {tier === 'gold' ? '황금 도장' : tier ? '기본 도장' : '아직 발견 못함'}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
