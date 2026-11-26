import type { Currency } from '../../engine/money.ts';

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/** Round axis bounds and evenly spaced ticks that include zero. Values are cents. */
export function niceScale(values: number[], tickCount = 4): Scale {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  if (lo === hi) return { min: 0, max: 100, ticks: [0, 100] };
  const raw = (hi - lo) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((f) => f * magnitude >= raw) ?? 10) * magnitude;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return { min, max, ticks };
}

/** Short axis label such as "€1.2K". */
export function formatCompact(cents: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(cents / 100);
}

/** "Jan", with the year added on January and on the first label so a long range stays readable. */
export function monthTick(month: string, first: boolean): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const name = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  return first || m === 1 ? `${name} ’${String(y).slice(2)}` : name;
}

/** Label every n-th month so the labels fit: about 52 pixels each, and never more than 12. */
export const labelEvery = (count: number, plotWidth = 576) => Math.max(1, Math.ceil(count / Math.min(12, Math.max(2, Math.floor(plotWidth / 52)))));
