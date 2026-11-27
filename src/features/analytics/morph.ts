/**
 * Chart transitions. A chart's state is a View: which months are in sight, the y-range, and the values per month.
 * Between two views everything is blended, so on a new time period the months slide to their place,
 * the axis rescales and months that come or go move in or out at the edge.
 */
import { useEffect, useRef, useState } from 'react';

/** Months as numbers that count up by one per month, so a window can sit between two months mid-transition. */
export const ordinal = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return y * 12 + m - 1;
};

export interface View {
  /** Window in sight: from the start of month `lo` to the start of month `hi` (ordinals, may be fractional). */
  lo: number;
  hi: number;
  /** Y-range. */
  min: number;
  max: number;
  /** One value per series for each month, keyed by ordinal. */
  values: Map<number, number[]>;
}

export function viewOf(months: string[], series: number[][], min: number, max: number): View {
  const values = new Map<number, number[]>();
  months.forEach((m, i) => values.set(ordinal(m), series.map((s) => s[i] ?? 0)));
  const lo = months.length > 0 ? ordinal(months[0]!) : 0;
  return { lo, hi: months.length > 0 ? ordinal(months.at(-1)!) + 1 : lo + 1, min, max, values };
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * The view `p` of the way from `a` to `b`. A month only one side has keeps that side's values,
 * since it is outside the window on the other side and comes into sight by sliding, not growing.
 */
export function blend(a: View, b: View, p: number): View {
  const values = new Map<number, number[]>();
  for (const key of new Set([...a.values.keys(), ...b.values.keys()])) {
    const to = b.values.get(key) ?? a.values.get(key)!;
    const from = a.values.get(key) ?? to;
    values.set(key, to.map((v, i) => lerp(from[i] ?? v, v, p)));
  }
  return { lo: lerp(a.lo, b.lo, p), hi: lerp(a.hi, b.hi, p), min: lerp(a.min, b.min, p), max: lerp(a.max, b.max, p), values };
}

/** Fast start, gentle stop. */
export const easeOut = (p: number) => 1 - (1 - p) ** 3;

export const DURATION = 320;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Returns what to draw for `target`: the target itself, or a step on the way to it after it changed.
 * `signature` names the target's content, so a new object with the same numbers does not start a transition.
 * A change mid-transition starts from what is on screen. With reduced motion the change is instant.
 */
export function useTween<T>(target: T, signature: string, mix: (a: T, b: T, p: number) => T): T {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  const latest = useRef(target);
  latest.current = target;
  useEffect(() => {
    const to = latest.current;
    const from = current.current;
    if (from === to || reducedMotion()) {
      current.current = to;
      setShown(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      const next = p === 1 ? to : mix(from, to, easeOut(p));
      current.current = next;
      setShown(next);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature stands for the target's content
  }, [signature]);
  return shown;
}

/** Content signature of a view. */
export const signatureOf = (v: View) => `${v.lo}:${v.hi}:${v.min}:${v.max}:${[...v.values].map(([k, s]) => `${k}=${s.join(',')}`).join(';')}`;

/** useTween for chart views. */
export const useMorph = (target: View) => useTween(target, signatureOf(target), blend);
