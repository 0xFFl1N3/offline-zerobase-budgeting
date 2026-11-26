import { useState } from 'react';
import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { IncomeSpendingRow } from '../../engine/reports.ts';
import { ChartFrame, ChartReadout, DataTable, Legend, PAD, barPath, plotWidth, useChartWidth, yOf } from './ChartFrame.tsx';
import { SERIES_COLORS } from './colors.ts';
import { niceScale } from './scale.ts';

const INCOME = SERIES_COLORS[0];
const SPENDING = SERIES_COLORS[1];

export function IncomeSpendingChart({ rows, currency }: { rows: IncomeSpendingRow[]; currency: Currency }) {
  const [active, setActive] = useState<number | null>(null);
  const fmt = (c: number) => formatMoney(c, currency);
  const scale = niceScale(rows.flatMap((r) => [r.income, r.spending]));
  const [box, width] = useChartWidth();
  const col = plotWidth(width) / rows.length;
  const group = Math.min(col * 0.7, 58);
  const bar = (group - 2) / 2; // 2px surface gap between the pair
  const base = yOf(0, scale);

  const totals = rows.reduce((t, r) => ({ income: t.income + r.income, spending: t.spending + r.spending }), { income: 0, spending: 0 });
  const describe = (i: number) => {
    const r = rows[i]!;
    return `${formatMonth(r.month)}: income ${fmt(r.income)}, spending ${fmt(r.spending)}, net ${fmt(r.net)}`;
  };

  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Income vs. spending</h3>
        <Legend items={[{ label: 'Income', color: INCOME }, { label: 'Spending', color: SPENDING }]} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <div><dt className="text-xs text-slate-500">Income</dt><dd className="text-lg font-semibold tabular-nums">{fmt(totals.income)}</dd></div>
        <div><dt className="text-xs text-slate-500">Spending</dt><dd className="text-lg font-semibold tabular-nums">{fmt(totals.spending)}</dd></div>
        <div>
          <dt className="text-xs text-slate-500">Net</dt>
          <dd className={`text-lg font-semibold tabular-nums ${totals.income - totals.spending < 0 ? 'text-red-600' : ''}`}>{fmt(totals.income - totals.spending)}</dd>
        </div>
      </dl>
      <div ref={box} className="mt-3">
        <ChartFrame width={width} months={rows.map((r) => r.month)} scale={scale} currency={currency} label="Income and spending per month" active={active} onActive={setActive} describe={describe}>
          {rows.map((r, i) => {
            const x = PAD.left + i * col + (col - group) / 2;
            return (
              <g key={r.month} pointerEvents="none">
                <path d={barPath(x, bar, base, yOf(r.income, scale))} fill={INCOME} />
                <path d={barPath(x + bar + 2, bar, base, yOf(r.spending, scale))} fill={SPENDING} />
              </g>
            );
          })}
        </ChartFrame>
      </div>
      <ChartReadout text={active === null ? null : describe(active)} />
      <DataTable
        head={['Month', 'Income', 'Spending', 'Net']}
        rows={rows.map((r) => [formatMonth(r.month), fmt(r.income), fmt(r.spending), fmt(r.net)])}
      />
    </article>
  );
}
