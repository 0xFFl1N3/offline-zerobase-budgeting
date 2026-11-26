import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { MonthValue } from '../../engine/reports.ts';
import { DataTable } from './ChartFrame.tsx';
import { SERIES_COLORS } from './colors.ts';
import { LineChart } from './LineChart.tsx';
import { t } from '../../i18n/i18n.ts';

export function NetWorthChart({ rows, currency }: { rows: MonthValue[]; currency: Currency }) {
  const fmt = (c: number) => formatMoney(c, currency);
  const first = rows[0]!.value;
  const last = rows.at(-1)!.value;
  const change = last - first;
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold">{t('analytics.netWorth')}</h3>
      <p className="text-xs text-slate-500">{t('analytics.netWorthHint')}</p>
      <p className="mt-3 text-lg font-semibold tabular-nums">
        {fmt(last)}{' '}
        <span className={`text-sm font-normal ${change < 0 ? 'text-red-600' : 'text-slate-500'}`}>
          {t('analytics.since', { change: (change >= 0 ? '+' : '') + fmt(change), month: formatMonth(rows[0]!.month) })}
        </span>
      </p>
      <div className="mt-3">
        <LineChart
          rows={rows}
          currency={currency}
          color={SERIES_COLORS[0]}
          label={t('analytics.netWorthLabel')}
          describe={(r) => `${formatMonth(r.month)}: ${fmt(r.value)}`}
        />
      </div>
      <DataTable head={[t('analytics.month'), t('analytics.netWorth')]} rows={rows.map((r) => [formatMonth(r.month), fmt(r.value)])} />
    </article>
  );
}
