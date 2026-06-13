"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up that animates 0→target once, ~1.15s cubic ease-out, and is
 * state-driven so re-renders never reset it (per the design's motion rule).
 */
export function useCountUp(targets: number[], { delay = 360, duration = 1150 } = {}) {
  const [values, setValues] = useState<number[]>(() => targets.map(() => 0));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let raf = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const timer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const e = ease(Math.min(1, (now - t0) / duration));
        setValues(targets.map((target) => Math.round(e * target)));
        if (now - t0 < duration) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return values;
}
