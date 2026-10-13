import { useEffect, useRef, useState } from 'react';
import { mixView, sameView, type View } from './mapView';

const DURATION = 380; // 밀리초
const ease = (t: number) => 1 - Math.pow(1 - t, 3); // 빨리 시작해서 부드럽게 멈춤

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 목표 영역이 바뀌면 지금 영역에서 목표까지 부드럽게 움직인다.
 * 움직임을 줄이는 설정이거나 애니메이션을 쓸 수 없는 환경이면 바로 바꾼다.
 */
export function useAnimatedView(target: View): View {
  const [view, setView] = useState<View>(target);
  const current = useRef<View>(target);

  useEffect(() => {
    if (sameView(current.current, target)) return;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      current.current = target;
      setView(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    // rAF가 주는 시간 대신 performance.now()로 직접 잰다 (환경마다 시간 기준이 달라도 안전). 진행도는 0~1로 제한한다.
    const tick = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - start) / DURATION));
      const next = t >= 1 ? target : mixView(from, target, ease(t));
      current.current = next;
      setView(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // target은 값이 같아도 새 객체일 수 있어서 좌표로 비교한다
  }, [target.x, target.y, target.w, target.h]);

  return view;
}
