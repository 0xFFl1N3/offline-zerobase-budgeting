import { useState } from 'react';
import type { Currency } from '../../engine/money.ts';
import type { MonthValue } from '../../engine/reports.ts';
import { ChartFrame, ChartReadout, layoutOf, monthsOf, useChartWidth } from './ChartFrame.tsx';
import { ordinal, useMorph, viewOf } from './morph.ts';
import { niceScale } from './scale.ts';

interface Props {
  rows: MonthValue[];
  currency: Currency;
  color: string;
  label: string;
  describe: (row: MonthValue) => string;
  formatTick?: (value: number) => string;
}

/** One series over months: a 2px line, with a marker on the hovered month. */
export function LineChart({ rows, currency, color, label, describe, formatTick }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const scale = niceScale(rows.map((r) => r.value));
  const [box, width] = useChartWidth();
  // What is drawn follows the data with a short transition (see morph.ts).
  const view = useMorph(viewOf(rows.map((r) => r.month), [rows.map((r) => r.value)], scale.min, scale.max));
  const { col, left, y } = layoutOf(view, width);
  const point = (month: number, value: number) => [left(month) + col / 2, y(value)] as const;
  const pts = monthsOf(view).map(([m, [v]]) => point(m, v!));
  const d = pts.map(([x, py], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const activeMonth = active === null || rows[active] === undefined ? null : ordinal(rows[active].month);
  const activePoint = activeMonth === null ? null : point(activeMonth, view.values.get(activeMonth)?.[0] ?? rows[active!]!.value);

  return (
    <>
      <div ref={box}>
      <ChartFrame
        width={width}
        months={rows.map((r) => r.month)}
        scale={scale}
        view={view}
        currency={currency}
        label={label}
        active={active}
        onActive={setActive}
        describe={(i) => describe(rows[i]!)}
        formatTick={formatTick}
      >
        <g pointerEvents="none">
          {pts.length === 1 ? (
            <circle cx={pts[0]![0]} cy={pts[0]![1]} r={4} fill={color} />
          ) : (
            <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {activePoint && (
            <circle cx={activePoint[0]} cy={activePoint[1]} r={5} fill={color} strokeWidth={2} style={{ stroke: 'var(--chart-surface)' }} />
          )}
        </g>
      </ChartFrame>
      </div>
      <ChartReadout text={active === null ? null : describe(rows[active]!)} />
    </>
  );
}
