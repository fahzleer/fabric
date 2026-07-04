"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type CountUpNumberProps = {
  value: number;
  /** Seconds. Kept short — a dashboard stat shouldn't feel like it's loading. */
  duration?: number;
  formatter?: ((n: number) => string) | undefined;
};

/**
 * Animates a stat's digits from its previous value to the new one whenever
 * `value` changes (mount included) — dashboard numbers should feel alive on
 * update, not just fade in once. Collapses to an instant jump under
 * reduced-motion.
 */
export function CountUpNumber({ value, duration = 0.6, formatter }: CountUpNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const prevValueRef = useRef(prefersReducedMotion ? value : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    let raf: number;
    const start = performance.now();
    const durationMs = duration * 1000;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, prefersReducedMotion]);

  return <>{formatter ? formatter(display) : display.toLocaleString()}</>;
}
