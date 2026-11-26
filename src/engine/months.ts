import type { Month } from './types.ts';

export const monthOf = (date: string): Month => date.slice(0, 7);

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  const year = Math.floor(idx / 12);
  const mon = (idx % 12) + 1;
  return `${year}-${String(mon).padStart(2, '0')}`;
}

/** Whole months from `from` to `to` (negative if `to` is earlier). */
export function monthsBetween(from: Month, to: Month): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM' as e.g. "November 2026" in the user's locale. */
export function formatMonth(month: Month): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
