import { useMemo, useState } from 'react';
import { CountryDetail } from '../../components/CountryDetail';
import { Flag } from '../../components/Flag';
import type { Content } from '../../data/content';
import type { PlayerProgress } from '../../types/progress';
import { companionOfCountry } from '../companions/companionEngine';
import { regionView, toPercent } from './mapView';
import { WORLD_LAND_PATH } from './worldLand';

/** 2D 세계지도: 발견한 나라는 국기 마커(황금/기본 테두리), 아직은 물음표 마커로 보여준다. */
export function MapPage({ progress, content }: { progress: PlayerProgress; content: Content }) {
  const [continent, setContinent] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const countries = useMemo(() => content.countries.filter((c) => c.status === 'verified'), [content.countries]);
  const continents = useMemo(() => [...new Set(countries.map((c) => c.continent))], [countries]);
  const view = regionView(countries, continent);
  const found = countries.filter((c) => progress.stampTiers[c.id]).length;
  const selected = countries.find((c) => c.id === selectedId);
  const zoomed = continent !== null;

  return (
    <div className="map-page">
      <h1>🗺️ 세계지도</h1>
      <p className="score"><strong>{found}</strong> / {countries.length}개 나라 발견</p>

      <div className="map-filters" role="group" aria-label="지도 보기">
        {[null, ...continents].map((c) => (
          <button
            key={c ?? 'all'}
            type="button"
            className={`chip ${c === continent ? 'active' : ''}`}
            aria-pressed={c === continent}
            onClick={() => setContinent(c)}
          >
            {c ?? '전체'}
          </button>
        ))}
      </div>

      <div className={`map-box ${zoomed ? 'zoomed' : ''}`}>
        <svg
          className="map-svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="세계지도"
        >
          <rect x="0" y="0" width="360" height="180" className="map-sea" />
          <path d={WORLD_LAND_PATH} className="map-land" fillRule="evenodd" />
        </svg>
        {countries.map((c) => {
          const pos = toPercent(c, view);
          if (!pos) return null;
          const tier = progress.stampTiers[c.id];
          return (
            <button
              key={c.id}
              type="button"
              className={`map-marker ${tier ? `has-${tier}` : 'locked'} ${selectedId === c.id ? 'selected' : ''}`}
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
              aria-label={`${tier ? c.nameKo : '아직 발견 못한 나라'}${tier ? (tier === 'gold' ? ', 황금 도장' : ', 기본 도장') : ''}`}
              aria-pressed={selectedId === c.id}
              onClick={() => setSelectedId(c.id)}
            >
              {tier ? <Flag country={c} decorative /> : <span aria-hidden="true">?</span>}
            </button>
          );
        })}
      </div>
      {!zoomed && <p className="hint">나라가 모여 있는 곳은 위의 대륙 버튼을 눌러 크게 볼 수 있어요.</p>}

      <ul className="map-legend" aria-label="범례">
        <li><span className="legend-dot gold" aria-hidden="true" /> ✨ 황금 도장</li>
        <li><span className="legend-dot basic" aria-hidden="true" /> 기본 도장</li>
        <li><span className="legend-dot locked" aria-hidden="true">?</span> 아직 못 찾았어요</li>
      </ul>

      {selected && <CountryDetail country={selected} tier={progress.stampTiers[selected.id]} companion={companionOfCountry(content, selected.id)} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
