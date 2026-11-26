import { useState } from 'react';
import type { Currency } from '../../engine/money.ts';
import type { MonthValue } from '../../engine/reports.ts';
import { ChartFrame, ChartReadout, PAD, PLOT_W, yOf } from './ChartFrame.tsx';
import { niceScale } from './scale.ts';

interface Props {
  rows: MonthValue[];
  currency: Currency;
  color: string;
  label: string;
  describe: (row: MonthValue) => string;
}

/** One series over months: a 2px line, with a marker on the hovered month. */
export function LineChart({ rows, currency, color, label, describe }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const scale = niceScale(rows.map((r) => r.value));
  const col = PLOT_W / rows.length;
  const pts = rows.map((r, i) => [PAD.left + (i + 0.5) * col, yOf(r.value, scale)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const activePoint = active === null ? null : pts[active]!;

  return (
    <>
      <ChartFrame
        months={rows.map((r) => r.month)}
        scale={scale}
        currency={currency}
        label={label}
        active={active}
        onActive={setActive}
        describe={(i) => describe(rows[i]!)}
      >
        <g pointerEvents="none">
          {rows.length === 1 ? (
            <circle cx={pts[0]![0]} cy={pts[0]![1]} r={4} fill={color} />
          ) : (
            <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {activePoint && (
            <circle cx={activePoint[0]} cy={activePoint[1]} r={5} fill={color} strokeWidth={2} style={{ stroke: 'var(--chart-surface)' }} />
          )}
        </g>
      </ChartFrame>
      <ChartReadout text={active === null ? null : describe(rows[active]!)} />
    </>
  );
}
