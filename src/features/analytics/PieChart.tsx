import { useState } from 'react';
import type { Slice } from '../../engine/analytics.ts';
import { formatMoney, formatPercent, type Currency } from '../../engine/money.ts';
import { t } from '../../i18n/i18n.ts';
import { OTHER_COLOR } from './colors.ts';

interface Props {
  slices: Slice[];
  total: number;
  currency: Currency;
  colors: Map<string, string>;
  /** What the chart shows, for screen readers, e.g. "Spending this month". */
  label: string;
}

const CENTER = 100;
const RADIUS = 92;

function point(angle: number): [number, number] {
  return [CENTER + RADIUS * Math.cos(angle), CENTER + RADIUS * Math.sin(angle)];
}

function slicePath(from: number, to: number): string {
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function PieChart({ slices: raw, total, currency, colors, label }: Props) {
  // The combined slice is named in the current language.
  const slices = raw.map((s) => (s.isOther ? { ...s, label: t('analytics.other') } : s));
  const [active, setActive] = useState<string | null>(null);
  const colorOf = (s: Slice) => (s.isOther ? OTHER_COLOR : (colors.get(s.id) ?? OTHER_COLOR));
  const fmt = (c: number) => formatMoney(c, currency);

  let angle = -Math.PI / 2; // start at 12 o'clock, go clockwise
  const arcs = slices.map((s) => {
    const sweep = (s.amount / total) * 2 * Math.PI;
    const arc = { slice: s, from: angle, to: angle + sweep };
    angle += sweep;
    return arc;
  });

  const describe = (s: Slice) => `${s.label}: ${fmt(s.amount)}, ${formatPercent(s.percent)}`;
  const activeSlice = slices.find((s) => s.id === active) ?? null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start lg:flex-col lg:items-center">
      <svg viewBox="0 0 200 200" className="h-48 w-48 shrink-0" role="img" aria-label={label}>
        {arcs.length === 1 ? (
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={colorOf(arcs[0]!.slice)} />
        ) : (
          arcs.map(({ slice, from, to }) => (
            <path
              key={slice.id}
              d={slicePath(from, to)}
              fill={colorOf(slice)}
              style={{ stroke: 'var(--chart-surface)' }}
              strokeWidth={2}
              strokeLinejoin="round"
              opacity={active === null || active === slice.id ? 1 : 0.45}
              tabIndex={0}
              role="img"
              aria-label={describe(slice)}
              onMouseEnter={() => setActive(slice.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(slice.id)}
              onBlur={() => setActive(null)}
              className="cursor-pointer outline-none focus-visible:stroke-slate-900"
            >
              <title>{describe(slice)}</title>
            </path>
          ))
        )}
      </svg>

      <div className="w-full min-w-0">
        <p className="h-5 text-center text-sm font-medium sm:text-left lg:text-center" aria-live="polite">
          {activeSlice ? describe(activeSlice) : ''}
        </p>
        <ul className="mt-1 w-full text-sm">
          {slices.map((s) => (
            <li
              key={s.id}
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2 rounded px-1 py-0.5 ${active === s.id ? 'bg-slate-100' : ''}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(s) }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tabular-nums text-slate-700">{fmt(s.amount)}</span>
              <span className="w-14 text-right tabular-nums text-slate-500">{formatPercent(s.percent)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
