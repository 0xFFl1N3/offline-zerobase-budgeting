import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { MonthValue } from '../../engine/reports.ts';
import { DataTable } from './ChartFrame.tsx';
import { SERIES_COLORS } from './colors.ts';
import { LineChart } from './LineChart.tsx';

export function NetWorthChart({ rows, currency }: { rows: MonthValue[]; currency: Currency }) {
  const fmt = (c: number) => formatMoney(c, currency);
  const first = rows[0]!.value;
  const last = rows.at(-1)!.value;
  const change = last - first;
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold">Net worth</h3>
      <p className="text-xs text-slate-500">Total of all account balances at the end of each month</p>
      <p className="mt-3 text-lg font-semibold tabular-nums">
        {fmt(last)}{' '}
        <span className={`text-sm font-normal ${change < 0 ? 'text-red-600' : 'text-slate-500'}`}>
          {change >= 0 ? '+' : ''}{fmt(change)} since {formatMonth(rows[0]!.month)}
        </span>
      </p>
      <div className="mt-3">
        <LineChart
          rows={rows}
          currency={currency}
          color={SERIES_COLORS[0]}
          label="Net worth at the end of each month"
          describe={(r) => `${formatMonth(r.month)}: ${fmt(r.value)}`}
        />
      </div>
      <DataTable head={['Month', 'Net worth']} rows={rows.map((r) => [formatMonth(r.month), fmt(r.value)])} />
    </article>
  );
}
