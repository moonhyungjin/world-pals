import { useCallback, useEffect, useRef, useState } from 'react';
import { mixView, sameView, type View } from './mapView';

const DURATION = 380; // 밀리초
const ease = (t: number) => 1 - Math.pow(1 - t, 3); // 빨리 시작해서 부드럽게 멈춤

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 지도 카메라(보이는 영역). 두 가지로 움직인다.
 * - 목표 영역(target)이 바뀌면(나라/대륙 선택) 지금 영역에서 목표까지 부드럽게 움직인다. 움직임을 줄이는 설정이면 바로 바뀐다.
 * - 사용자가 손/휠/버튼으로 직접 옮기면(jumpTo) 애니메이션을 멈추고 그 자리로 바로 간다. 이때 manual이 true가 된다.
 *
 * nonce가 바뀌면 목표가 그대로여도 다시 목표로 돌아간다 (확대해 둔 상태에서 같은 나라를 다시 누른 경우 등).
 */
export function useMapCamera(target: View, nonce = 0) {
  const [view, setView] = useState<View>(target);
  const [manual, setManual] = useState(false);
  const current = useRef<View>(target); // 애니메이션 중에도 항상 지금 보이는 영역
  const frame = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  const stop = useCallback(() => {
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
  }, []);

  const animateTo = useCallback(
    (to: View) => {
      stop();
      if (sameView(current.current, to)) {
        setView(to);
        return;
      }
      if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
        current.current = to;
        setView(to);
        return;
      }
      const from = current.current;
      const start = performance.now();
      // rAF가 주는 시간 대신 performance.now()로 직접 잰다 (환경마다 시간 기준이 달라도 안전). 진행도는 0~1로 제한한다.
      const tick = () => {
        const t = Math.min(1, Math.max(0, (performance.now() - start) / DURATION));
        const next = t >= 1 ? to : mixView(from, to, ease(t));
        current.current = next;
        setView(next);
        frame.current = t < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame.current = requestAnimationFrame(tick);
    },
    [stop],
  );

  useEffect(() => {
    setManual(false);
    animateTo(target);
    return stop;
    // target은 값이 같아도 새 객체일 수 있어서 좌표로 비교한다
  }, [target.x, target.y, target.w, target.h, nonce, animateTo, stop]);

  /** 사용자가 직접 옮긴 영역으로 바로 간다. */
  const jumpTo = useCallback(
    (v: View) => {
      stop();
      current.current = v;
      setView(v);
      setManual(true);
    },
    [stop],
  );

  const getView = useCallback(() => current.current, []);

  /** 직접 옮기기 전의 목표 영역(나라/대륙/세계)으로 돌아간다. */
  const reset = useCallback(() => {
    setManual(false);
    animateTo(targetRef.current);
  }, [animateTo]);

  return { view, manual, jumpTo, getView, reset };
}

export type MapCamera = ReturnType<typeof useMapCamera>;
