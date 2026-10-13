import { useMemo, useState } from 'react';
import { CountryDetail } from '../../components/CountryDetail';
import { Flag } from '../../components/Flag';
import type { Content } from '../../data/content';
import type { Country } from '../../types/country';
import type { PlayerProgress } from '../../types/progress';
import { companionOfCountry } from '../companions/companionEngine';
import { COUNTRY_SHAPES } from './countryShapes';
import { EAST_OVERHANG, focusView, project, regionView, toPercent, toPercentRaw, type View } from './mapView';
import { useAnimatedView } from './useAnimatedView';
import { WORLD_LAND_PATH } from './worldLand';

/** 가장자리 마커가 잘리지 않도록 지도 안쪽으로 살짝 당긴다 (위치 오차는 3% 이내). */
const inside = (percent: number, margin: number) => Math.min(100 - margin, Math.max(margin, percent));

/** 나라로 확대할 때 쓸 상자. 영역 데이터가 없는 나라(새로 추가했는데 gen:map을 아직 안 돌린 경우)는 수도 주변을 보여준다. */
function boxOf(country: Country): [number, number, number, number] | null {
  const shape = COUNTRY_SHAPES[country.id];
  if (shape) return shape.box;
  const p = project(country);
  return p ? [p.x - 1, p.y - 1, p.x + 1, p.y + 1] : null;
}

/**
 * 2D 세계지도. 도장을 받은 나라는 영역이 도장 색으로 칠해지고(황금/기본), 누르면 그 나라로 확대된다.
 * 아직 못 찾은 나라는 칠하지도 확대하지도 않는다 (모양이 힌트가 되지 않게). 마커와 목록 칩은 영역을 누르기 어려운 작은 나라를 위해 계속 둔다.
 */
export function MapPage({ progress, content }: { progress: PlayerProgress; content: Content }) {
  const [continent, setContinent] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const countries = useMemo(() => content.countries.filter((c) => c.status === 'verified'), [content.countries]);
  const continents = useMemo(() => [...new Set(countries.map((c) => c.continent))], [countries]);
  const found = countries.filter((c) => progress.stampTiers[c.id]).length;
  const selected = countries.find((c) => c.id === selectedId);
  const tierOf = (id: string) => progress.stampTiers[id];

  // 발견한 나라를 골랐을 때만 그 나라로 확대한다.
  const focused = selected && tierOf(selected.id) ? selected : undefined;
  const focusBox = focused ? boxOf(focused) : null;
  const target: View = useMemo(
    () => (focusBox ? focusView(focusBox) : regionView(countries, continent)),
    // 값(좌표)이 바뀔 때만 새 목표로 본다
    [countries, continent, focusBox?.join(',')],
  );
  const view = useAnimatedView(target);
  const zoomed = continent !== null;

  const discovered = countries.filter((c) => tierOf(c.id) && COUNTRY_SHAPES[c.id]);

  const pick = (id: string) => setSelectedId(id);
  const changeContinent = (c: string | null) => {
    setContinent(c);
    setSelectedId(null); // 대륙을 바꾸면 나라 확대는 풀린다
  };

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
            onClick={() => changeContinent(c)}
          >
            {c ?? '전체'}
          </button>
        ))}
      </div>

      <div className={`map-box ${zoomed || focused ? 'zoomed' : ''} ${focused ? 'focused' : ''}`}>
        <svg
          className="map-svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={focused ? `${focused.nameKo} 지도` : '세계지도'}
        >
          <rect x="0" y="0" width={360 + EAST_OVERHANG} height="180" className="map-sea" />
          <g id="map-layer">
            <path d={WORLD_LAND_PATH} className="map-land" fillRule="evenodd" />
            {/* 도장을 받은 나라만 칠한다. 키보드/스크린리더는 아래의 마커와 목록을 쓰므로 영역은 눈으로 누르는 용도다. */}
            <g aria-hidden="true">
              {discovered.map((c) => (
                <path
                  key={c.id}
                  data-country={c.id}
                  d={COUNTRY_SHAPES[c.id].d}
                  className={`country-area ${tierOf(c.id)} ${selectedId === c.id ? 'selected' : ''}`}
                  fillRule="evenodd"
                  onClick={() => pick(c.id)}
                />
              ))}
            </g>
          </g>
          {/* 날짜변경선 오른쪽으로 지도를 한 번 더 이어 붙인다 (피지 같은 나라가 반쪽만 보이지 않게). 눌러지지는 않는다. */}
          <use href="#map-layer" transform="translate(360 0)" pointerEvents="none" aria-hidden="true" />
        </svg>
        {countries.map((c) => {
          // 나라로 확대했을 땐 그 나라 마커만, 대륙을 확대했을 땐 그 대륙의 마커만 (가장자리에 걸친 마커가 잘려 보이지 않게)
          if (focused ? c.id !== focused.id : zoomed && c.continent !== continent) return null;
          if (!toPercent(c, target)) return null; // 목표 영역 안에 있는 나라만
          const pos = toPercentRaw(c, view)!; // 위치는 지금 움직이는 영역을 따라간다
          const tier = tierOf(c.id);
          const edge = zoomed || focused;
          return (
            <button
              key={c.id}
              type="button"
              className={`map-marker ${tier ? `has-${tier}` : 'locked'} ${selectedId === c.id ? 'selected' : ''}`}
              style={{ left: `${inside(pos.left, edge ? 6 : 4)}%`, top: `${inside(pos.top, edge ? 8 : 5)}%` }}
              aria-label={`${tier ? c.nameKo : '아직 발견 못한 나라'}${tier ? (tier === 'gold' ? ', 황금 도장' : ', 기본 도장') : ''}`}
              aria-pressed={selectedId === c.id}
              onClick={() => pick(c.id)}
            >
              {tier ? <Flag country={c} decorative /> : <span aria-hidden="true">?</span>}
            </button>
          );
        })}
      </div>
      {!zoomed && !focused && (
        <p className="hint">색칠된 나라를 누르면 그 나라로 확대돼요. 나라가 모여 있는 곳은 위의 대륙 버튼을 눌러요.</p>
      )}
      {zoomed && (
        // 마커가 겹쳐서 가려진 나라도 눌러 볼 수 있도록, 이 대륙의 나라를 목록으로도 보여준다.
        <ul className="map-list" aria-label={`${continent} 나라 목록`}>
          {countries
            .filter((c) => c.continent === continent)
            .map((c) => {
              const tier = tierOf(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`map-chip ${tier ? `has-${tier}` : 'locked'} ${selectedId === c.id ? 'selected' : ''}`}
                    aria-pressed={selectedId === c.id}
                    onClick={() => pick(c.id)}
                  >
                    {tier ? <Flag country={c} decorative /> : <span className="chip-q" aria-hidden="true">?</span>}
                    <span>{tier ? c.nameKo : '???'}</span>
                    {!tier && <span className="sr-only">아직 발견 못한 나라</span>}
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      <ul className="map-legend" aria-label="범례">
        <li><span className="legend-dot gold" aria-hidden="true" /> ✨ 황금 도장</li>
        <li><span className="legend-dot basic" aria-hidden="true" /> 기본 도장</li>
        <li><span className="legend-dot locked" aria-hidden="true">?</span> 아직 못 찾았어요</li>
      </ul>

      {selected && (
        <CountryDetail
          country={selected}
          tier={tierOf(selected.id)}
          companion={companionOfCountry(content, selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
