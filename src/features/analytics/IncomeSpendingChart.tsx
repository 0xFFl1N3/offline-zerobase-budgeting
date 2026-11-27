import { useState } from 'react';
import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { IncomeSpendingRow } from '../../engine/reports.ts';
import { ChartFrame, ChartReadout, DataTable, Legend, barPath, layoutOf, monthsOf, useChartWidth } from './ChartFrame.tsx';
import { useMorph, viewOf } from './morph.ts';
import { SERIES_COLORS } from './colors.ts';
import { niceScale } from './scale.ts';
import { t } from '../../i18n/i18n.ts';

const INCOME = SERIES_COLORS[0];
const SPENDING = SERIES_COLORS[1];

export function IncomeSpendingChart({ rows, currency }: { rows: IncomeSpendingRow[]; currency: Currency }) {
  const [active, setActive] = useState<number | null>(null);
  const fmt = (c: number) => formatMoney(c, currency);
  const scale = niceScale(rows.flatMap((r) => [r.income, r.spending]));
  const [box, width] = useChartWidth();
  // What is drawn follows the data with a short transition (see morph.ts).
  const view = useMorph(viewOf(rows.map((r) => r.month), [rows.map((r) => r.income), rows.map((r) => r.spending)], scale.min, scale.max));
  const { col, left, y } = layoutOf(view, width);
  const group = Math.min(col * 0.7, 58);
  const bar = (group - 2) / 2; // 2px surface gap between the pair
  const base = y(0);

  const totals = rows.reduce((t, r) => ({ income: t.income + r.income, spending: t.spending + r.spending }), { income: 0, spending: 0 });
  const describe = (i: number) => {
    const r = rows[i]!;
    return t('analytics.incomeDescribe', { month: formatMonth(r.month), income: fmt(r.income), spending: fmt(r.spending), net: fmt(r.net) });
  };

  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('analytics.incomeVsSpending')}</h3>
        <Legend items={[{ label: t('analytics.income'), color: INCOME }, { label: t('analytics.spending'), color: SPENDING }]} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <div><dt className="text-xs text-slate-500">{t('analytics.income')}</dt><dd className="text-lg font-semibold tabular-nums">{fmt(totals.income)}</dd></div>
        <div><dt className="text-xs text-slate-500">{t('analytics.spending')}</dt><dd className="text-lg font-semibold tabular-nums">{fmt(totals.spending)}</dd></div>
        <div>
          <dt className="text-xs text-slate-500">{t('analytics.net')}</dt>
          <dd className={`text-lg font-semibold tabular-nums ${totals.income - totals.spending < 0 ? 'text-red-600' : ''}`}>{fmt(totals.income - totals.spending)}</dd>
        </div>
      </dl>
      <div ref={box} className="mt-3">
        <ChartFrame width={width} months={rows.map((r) => r.month)} scale={scale} view={view} currency={currency} label={t('analytics.incomeLabel')} active={active} onActive={setActive} describe={describe}>
          {monthsOf(view).map(([m, [income, spending]]) => {
            const x = left(m) + (col - group) / 2;
            return (
              <g key={m} pointerEvents="none">
                <path d={barPath(x, bar, base, y(income!))} fill={INCOME} />
                <path d={barPath(x + bar + 2, bar, base, y(spending!))} fill={SPENDING} />
              </g>
            );
          })}
        </ChartFrame>
      </div>
      <ChartReadout text={active === null ? null : describe(active)} />
      <DataTable
        head={[t('analytics.month'), t('analytics.income'), t('analytics.spending'), t('analytics.net')]}
        rows={rows.map((r) => [formatMonth(r.month), fmt(r.income), fmt(r.spending), fmt(r.net)])}
      />
    </article>
  );
}
