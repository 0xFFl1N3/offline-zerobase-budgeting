import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Currency } from '../../engine/money.ts';
import { t } from '../../i18n/i18n.ts';
import { ordinal, type View } from './morph.ts';
import { formatCompact, labelEvery, monthTick, type Scale } from './scale.ts';

/**
 * Drawing area shared by the over-time charts. The width follows the space the chart gets (see useChartWidth),
 * so one unit is one screen pixel and labels keep their size on a phone.
 */
export const H = 220;
export const PAD = { left: 56, right: 8, top: 10, bottom: 26 };
export const PLOT_H = H - PAD.top - PAD.bottom;
export const plotWidth = (width: number) => width - PAD.left - PAD.right;

/** Measures the element the ref is put on; returns its width in pixels (640 until measured). */
export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Where things go for a view at a given width: the column width, a month's left edge, a value's height. */
export interface Layout {
  col: number;
  left: (month: number) => number;
  y: (value: number) => number;
}

export function layoutOf(view: View, width: number): Layout {
  const col = plotWidth(width) / Math.max(view.hi - view.lo, 1e-6);
  const span = view.max - view.min || 1;
  return { col, left: (m) => PAD.left + (m - view.lo) * col, y: (v) => PAD.top + PLOT_H - ((v - view.min) / span) * PLOT_H };
}

/** Months in the view, oldest first, with their values; used by the charts to draw their marks. */
export const monthsOf = (view: View) => [...view.values.entries()].sort((a, b) => a[0] - b[0]);

interface Props {
  /** From useChartWidth. */
  width: number;
  months: string[];
  /** The target's scale, for the tick values. */
  scale: Scale;
  /** What is on screen (see useMorph); positions follow it, so axes and labels move with the marks. */
  view: View;
  currency: Currency;
  label: string;
  /** Index of the hovered month, or null. */
  active: number | null;
  onActive: (index: number | null) => void;
  /** Accessible description of one month, read when its column is focused. */
  describe: (index: number) => string;
  children: ReactNode;
  /** Y-axis label; money by default. */
  formatTick?: (value: number) => string;
}

/** Axes, gridlines, month labels and one hover/focus column per month. The marks go in `children`. */
export function ChartFrame({ width, months, scale, view, currency, label, active, onActive, describe, children, formatTick }: Props) {
  const W = width;
  const { col, left, y } = layoutOf(view, W);
  const every = labelEvery(months.length, plotWidth(W));
  const clip = `plot${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // While the view moves, ticks and labels that are outside the plot are left out.
  const inPlotY = (v: number) => y(v) >= PAD.top - 0.5 && y(v) <= PAD.top + PLOT_H + 0.5;
  const inPlotX = (x: number) => x >= PAD.left - 0.5 && x <= W - PAD.right + 0.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <rect x={PAD.left} y={0} width={plotWidth(W)} height={H} />
        </clipPath>
      </defs>
      {scale.ticks.filter(inPlotY).map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-slate-400' : 'stroke-slate-200'} strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
            {formatTick ? formatTick(t) : formatCompact(t, currency)}
          </text>
        </g>
      ))}
      {active !== null && months[active] !== undefined && (
        <rect x={left(ordinal(months[active]))} y={PAD.top} width={col} height={PLOT_H} className="fill-slate-100" />
      )}
      <g clipPath={`url(#${clip})`}>{children}</g>
      {months.map((m, i) => {
        const x = left(ordinal(m)) + col / 2;
        return i % every === 0 && inPlotX(x) ? (
          <text key={m} x={x} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {monthTick(m, i === 0)}
          </text>
        ) : null;
      })}
      {months.map((m, i) => (
        <rect
          key={m}
          x={left(ordinal(m))}
          y={PAD.top}
          width={col}
          height={PLOT_H}
          fill="transparent"
          tabIndex={0}
          role="img"
          aria-label={describe(i)}
          onMouseEnter={() => onActive(i)}
          onMouseLeave={() => onActive(null)}
          onFocus={() => onActive(i)}
          onBlur={() => onActive(null)}
          className="cursor-default outline-none focus-visible:stroke-slate-500"
        >
          <title>{describe(i)}</title>
        </rect>
      ))}
    </svg>
  );
}

/** One line under a chart naming the hovered month's values (or a hint). */
export function ChartReadout({ text }: { text: string | null }) {
  return (
    <p className="min-h-5 text-sm font-medium" aria-live="polite">
      {text ?? <span className="font-normal text-slate-500">{t('analytics.hover')}</span>}
    </p>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** The chart's numbers as a table, folded away by default. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-sky-700">{t('analytics.showTable')}</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              {head.map((h, i) => (
                <th key={h} className={`py-1 font-medium ${i > 0 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[0])} className="border-t border-slate-100">
                {r.map((c, i) => (
                  <td key={i} className={`py-1 ${i > 0 ? 'text-right' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A bar from the baseline to `yEnd`, with the end away from the baseline rounded. */
export function barPath(x: number, w: number, yBase: number, yEnd: number, r = 4): string {
  const h = Math.abs(yEnd - yBase);
  if (h < 0.5 || w <= 0) return '';
  const q = Math.min(r, w / 2, h);
  if (yEnd < yBase) {
    return `M${x},${yBase} V${yEnd + q} Q${x},${yEnd} ${x + q},${yEnd} H${x + w - q} Q${x + w},${yEnd} ${x + w},${yEnd + q} V${yBase} Z`;
  }
  return `M${x},${yBase} V${yEnd - q} Q${x},${yEnd} ${x + q},${yEnd} H${x + w - q} Q${x + w},${yEnd} ${x + w},${yEnd - q} V${yBase} Z`;
}
