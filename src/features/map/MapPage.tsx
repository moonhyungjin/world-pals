import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CountryDetail } from '../../components/CountryDetail';
import { Flag } from '../../components/Flag';
import type { Content } from '../../data/content';
import type { Country } from '../../types/country';
import type { PlayerProgress } from '../../types/progress';
import { companionOfCountry } from '../companions/companionEngine';
import { COUNTRY_SHAPES } from './countryShapes';
import { EAST_OVERHANG, focusView, MIN_VIEW_W, panBy, project, regionView, toPercent, toPercentRaw, WORLD_VIEW, zoomBy, type View } from './mapView';
import { useMapCamera } from './useMapCamera';
import { useMapGestures } from './useMapGestures';
import { WORLD_LAND_PATH } from './worldLand';

const ZOOM_STEP = 1.6; // 버튼/키보드 한 번에 확대되는 배율
const PAN_STEP = 0.15; // 화살표 키 한 번에 움직이는 비율(영역 크기 기준)
const CLOSE_UP_W = 200; // 영역 폭이 이보다 작으면 마커를 크게 보여준다

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
 * 손으로도 움직인다: 마우스 휠로 확대, 끌어서 이동, 터치는 두 손가락. 버튼(＋ － 처음 위치)과 키보드(+ - 화살표)도 있다.
 */
export function MapPage({ progress, content }: { progress: PlayerProgress; content: Content }) {
  const [continent, setContinent] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // 값이 같은 목표로도 다시 돌아가게 하는 신호

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
  const camera = useMapCamera(target, nonce);
  const { view, manual } = camera;
  const boxRef = useRef<HTMLDivElement>(null);
  const gestures = useMapGestures(boxRef, camera);

  const zoomed = continent !== null;
  const closeUp = view.w < CLOSE_UP_W;
  const discovered = countries.filter((c) => tierOf(c.id) && COUNTRY_SHAPES[c.id]);

  const pick = (id: string) => {
    setSelectedId(id);
    if (tierOf(id)) setNonce((n) => n + 1); // 직접 옮겨 둔 상태에서도 그 나라로 다시 확대
  };
  const changeContinent = (c: string | null) => {
    setContinent(c);
    setSelectedId(null); // 대륙을 바꾸면 나라 확대는 풀린다
    setNonce((n) => n + 1);
  };
  const closeDetail = () => {
    setSelectedId(null);
    setNonce((n) => n + 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // 브라우저 단축키(ctrl +/- 등)는 건드리지 않는다
    const v = camera.getView();
    const move = (dx: number, dy: number) => camera.jumpTo(panBy(v, dx, dy));
    switch (e.key) {
      case '+':
      case '=':
        camera.jumpTo(zoomBy(v, ZOOM_STEP));
        break;
      case '-':
      case '_':
        camera.jumpTo(zoomBy(v, 1 / ZOOM_STEP));
        break;
      case 'ArrowLeft':
        move(PAN_STEP, 0); // 왼쪽 키 = 영역이 왼쪽으로 = 내용이 오른쪽으로
        break;
      case 'ArrowRight':
        move(-PAN_STEP, 0);
        break;
      case 'ArrowUp':
        move(0, PAN_STEP);
        break;
      case 'ArrowDown':
        move(0, -PAN_STEP);
        break;
      case '0':
      case 'Home':
        camera.reset();
        break;
      default:
        return;
    }
    e.preventDefault();
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

      <div
        ref={boxRef}
        className={`map-box ${zoomed || focused || closeUp ? 'zoomed' : ''} ${focused ? 'focused' : ''} ${view.w < WORLD_VIEW.w ? 'can-drag' : ''}`}
        role="group"
        aria-label="세계지도. 화살표 키로 이동하고 더하기, 빼기 키로 확대 축소해요"
        tabIndex={0}
        onKeyDown={onKeyDown}
        {...gestures}
      >
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
          {/*
            날짜변경선 오른쪽으로 지도를 한 번 더 이어 붙인다 (피지 같은 나라가 반쪽만 보이지 않게). 눌러지지는 않는다.
            반드시 오른쪽 끝(360~420)만 보이게 잘라야 한다: 육지/영역 데이터에는 날짜변경선을 걸친 큰 덩어리의 -360 복사본이 이미 들어 있어서,
            자르지 않으면 그 복사본이 +360 이동해 원래 자리 위를 덮고 유라시아·아프리카 본토의 영역 색을 가린다.
          */}
          <defs>
            <clipPath id="east-overhang">
              <rect x={360} y={0} width={EAST_OVERHANG} height={180} />
            </clipPath>
          </defs>
          <g clipPath="url(#east-overhang)" data-testid="east-copy">
            <use href="#map-layer" transform="translate(360 0)" pointerEvents="none" aria-hidden="true" />
          </g>
        </svg>
        {countries.map((c) => {
          // 프리셋 보기(나라/대륙 확대)에서는 그 나라/대륙의 마커만, 손으로 옮기는 중에는 보이는 영역 안의 모든 마커를 보여준다.
          if (!manual && (focused ? c.id !== focused.id : zoomed && c.continent !== continent)) return null;
          if (!toPercent(c, manual ? view : target)) return null; // 영역 안에 있는 나라만
          const pos = toPercentRaw(c, view)!; // 위치는 지금 움직이는 영역을 따라간다
          const tier = tierOf(c.id);
          const edge = zoomed || focused || closeUp;
          const left = manual ? pos.left : inside(pos.left, edge ? 6 : 4);
          const top = manual ? pos.top : inside(pos.top, edge ? 8 : 5);
          return (
            <button
              key={c.id}
              type="button"
              className={`map-marker ${tier ? `has-${tier}` : 'locked'} ${selectedId === c.id ? 'selected' : ''}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-label={`${tier ? c.nameKo : '아직 발견 못한 나라'}${tier ? (tier === 'gold' ? ', 황금 도장' : ', 기본 도장') : ''}`}
              aria-pressed={selectedId === c.id}
              onClick={() => pick(c.id)}
            >
              {tier ? <Flag country={c} decorative /> : <span aria-hidden="true">?</span>}
            </button>
          );
        })}

        <div className="map-controls" role="group" aria-label="지도 확대와 이동">
          <button type="button" className="map-ctl" aria-label="확대" disabled={view.w <= MIN_VIEW_W + 1e-6} onClick={() => camera.jumpTo(zoomBy(camera.getView(), ZOOM_STEP))}>
            ＋
          </button>
          <button type="button" className="map-ctl" aria-label="축소" disabled={view.w >= WORLD_VIEW.w - 1e-6} onClick={() => camera.jumpTo(zoomBy(camera.getView(), 1 / ZOOM_STEP))}>
            －
          </button>
          {manual && (
            <button type="button" className="map-ctl" aria-label="처음 위치로" onClick={camera.reset}>
              ⟲
            </button>
          )}
        </div>
      </div>
      {!zoomed && !focused && (
        <p className="hint">색칠된 나라를 누르면 그 나라로 확대돼요. 나라가 모여 있는 곳은 위의 대륙 버튼을 눌러요.</p>
      )}
      <p className="hint map-gesture-hint">🖱️ 휠로 확대하고 끌어서 움직여요 · 📱 두 손가락으로 확대하고 움직여요</p>
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
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
