import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Currency } from '../../engine/money.ts';
import { t } from '../../i18n/i18n.ts';
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

export const yOf = (value: number, scale: Scale) => PAD.top + PLOT_H - ((value - scale.min) / (scale.max - scale.min)) * PLOT_H;

interface Props {
  /** From useChartWidth. */
  width: number;
  months: string[];
  scale: Scale;
  currency: Currency;
  label: string;
  /** Index of the hovered month, or null. */
  active: number | null;
  onActive: (index: number | null) => void;
  /** Accessible description of one month, read when its column is focused. */
  describe: (index: number) => string;
  children: ReactNode;
}

/** Axes, gridlines, month labels and one hover/focus column per month. The marks go in `children`. */
export function ChartFrame({ width, months, scale, currency, label, active, onActive, describe, children }: Props) {
  const W = width;
  const col = plotWidth(W) / months.length;
  const every = labelEvery(months.length, plotWidth(W));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={label}>
      {scale.ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yOf(t, scale)}
            y2={yOf(t, scale)}
            className={t === 0 ? 'stroke-slate-400' : 'stroke-slate-200'}
            strokeWidth={1}
          />
          <text x={PAD.left - 6} y={yOf(t, scale)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
            {formatCompact(t, currency)}
          </text>
        </g>
      ))}
      {active !== null && (
        <rect x={PAD.left + active * col} y={PAD.top} width={col} height={PLOT_H} className="fill-slate-100" />
      )}
      {children}
      {months.map((m, i) =>
        i % every === 0 ? (
          <text key={m} x={PAD.left + (i + 0.5) * col} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {monthTick(m, i === 0)}
          </text>
        ) : null,
      )}
      {months.map((m, i) => (
        <rect
          key={m}
          x={PAD.left + i * col}
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
