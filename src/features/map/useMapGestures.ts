import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { panBy, sameView, zoomAt } from './mapView';
import type { MapCamera } from './useMapCamera';

const DRAG_THRESHOLD = 4; // 픽셀. 이보다 적게 움직이면 끌기가 아니라 클릭으로 본다.
const WHEEL_SPEED = 0.0018;
const PINCH_WHEEL_SPEED = 0.01; // 트랙패드 핀치(ctrl+휠)는 값이 작게 오므로 더 민감하게

type Point = { x: number; y: number };

/**
 * 지도의 손/마우스 조작.
 * - 마우스 휠: 커서 위치를 기준으로 확대/축소. 더 이상 축소할 수 없을 때(세계 전체)는 페이지가 스크롤되게 둔다.
 * - 마우스 끌기: 이동. 끌고 난 뒤의 클릭은 무시해서 나라가 눌리지 않게 한다.
 * - 터치: **두 손가락**으로 확대/이동. 한 손가락은 건드리지 않아서 페이지가 스크롤된다 (CSS touch-action: pan-y).
 */
export function useMapGestures(boxRef: RefObject<HTMLDivElement | null>, camera: MapCamera) {
  const cam = useRef(camera);
  cam.current = camera;

  // ---- 마우스 휠 (preventDefault가 필요해서 passive가 아닌 기본 리스너로 단다) ----
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; // 줄/페이지 단위도 픽셀처럼
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? PINCH_WHEEL_SPEED : WHEEL_SPEED));
      const v = cam.current.getView();
      const next = zoomAt(v, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, factor);
      const changed = !sameView(next, v);
      if (!changed && e.deltaY > 0) return; // 더 줄일 수 없으면 지도에 가두지 않고 페이지를 스크롤
      e.preventDefault(); // 확대 중에는 페이지가 같이 스크롤되거나 브라우저가 확대되지 않게
      if (changed) cam.current.jumpTo(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef]);

  // ---- 포인터(마우스/터치) ----
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);
  const drag = useRef<{ start: Point; last: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const endSuppressSoon = () => {
    // 끌기/핀치 직후에 오는 click 하나만 무시한다. click이 안 오는 경우에도 곧 풀린다.
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };

  const pinchState = () => {
    const [a, b] = [...touches.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest?.('.map-controls')) return; // 버튼 위에서는 끌기를 시작하지 않는다
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        pinch.current = pinchState();
        suppressClick.current = true;
      }
    } else if (e.button === 0) {
      drag.current = { start: { x: e.clientX, y: e.clientY }, last: { x: e.clientX, y: e.clientY }, moved: false };
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    if (e.pointerType === 'touch') {
      if (!touches.current.has(e.pointerId)) return;
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size !== 2 || !pinch.current) return; // 한 손가락은 페이지 스크롤에 맡긴다
      const now = pinchState();
      const prev = pinch.current;
      const factor = prev.dist > 0 ? now.dist / prev.dist : 1;
      let v = cam.current.getView();
      v = zoomAt(v, (prev.mid.x - rect.left) / rect.width, (prev.mid.y - rect.top) / rect.height, factor);
      v = panBy(v, (now.mid.x - prev.mid.x) / rect.width, (now.mid.y - prev.mid.y) / rect.height);
      cam.current.jumpTo(v);
      pinch.current = now;
      return;
    }

    const d = drag.current;
    if (!d || e.buttons === 0) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < DRAG_THRESHOLD) return;
      d.moved = true;
      suppressClick.current = true;
      el.setPointerCapture?.(e.pointerId); // 지도 밖으로 나가도 계속 끌 수 있게
      el.classList.add('grabbing');
    }
    cam.current.jumpTo(panBy(cam.current.getView(), (e.clientX - d.last.x) / rect.width, (e.clientY - d.last.y) / rect.height));
    d.last = { x: e.clientX, y: e.clientY };
  };

  const release = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2 && pinch.current) {
        pinch.current = null;
        endSuppressSoon();
      }
      return;
    }
    if (drag.current?.moved) {
      boxRef.current?.releasePointerCapture?.(e.pointerId);
      boxRef.current?.classList.remove('grabbing');
      endSuppressSoon();
    }
    drag.current = null;
  };

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      e.stopPropagation(); // 끌다가 손을 뗀 자리의 나라가 눌리지 않게
      e.preventDefault();
      suppressClick.current = false;
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp: release, onPointerCancel: release, onClickCapture };
}
