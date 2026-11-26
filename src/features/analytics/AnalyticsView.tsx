import { useMemo, useState } from 'react';
import { spendingReport, type GroupBy, type ReportKind, type SpendingReport } from '../../engine/analytics.ts';
import { formatMoney } from '../../engine/money.ts';
import { formatMonth, formatMonthRange } from '../../engine/months.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { incomeVsSpending, netWorth, reportMonths, type RangeKey } from '../../engine/reports.ts';
import { useIsDark } from '../../theme.ts';
import { buildColorMap } from './colors.ts';
import { IncomeSpendingChart } from './IncomeSpendingChart.tsx';
import { NetWorthChart } from './NetWorthChart.tsx';
import { PieChart } from './PieChart.tsx';
import { RangeSwitch } from './RangeSwitch.tsx';

const KINDS: ReportKind[] = ['month', 'year-to-date', 'monthly-average'];

function titleFor(report: SpendingReport): { title: string; subtitle: string; totalLabel: string } {
  switch (report.kind) {
    case 'month':
      return { title: 'This month', subtitle: formatMonth(report.toMonth), totalLabel: 'spent' };
    case 'year-to-date':
      return { title: 'Year to date', subtitle: formatMonthRange(report.fromMonth, report.toMonth), totalLabel: 'spent' };
    case 'monthly-average':
      return {
        title: 'Monthly average',
        subtitle: `${formatMonthRange(report.fromMonth, report.toMonth)} · ${report.divisor} month${report.divisor === 1 ? '' : 's'} with data`,
        totalLabel: 'per month',
      };
  }
}

export function AnalyticsView() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const month = useBudgetStore((s) => s.month);
  const shiftMonth = useBudgetStore((s) => s.shiftMonth);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');

  const reports = useMemo(() => KINDS.map((k) => spendingReport(state, k, month, groupBy)), [state, month, groupBy]);
  // Year to date first: it contains every slice the other two can show, so colours stay put across the charts.
  const dark = useIsDark();
  const colors = useMemo(() => buildColorMap([reports[1]!, reports[0]!, reports[2]!], dark), [reports, dark]);
  const uncategorized = reports[1]!.uncategorizedCount;

  const [range, setRange] = useState<RangeKey>('12');
  const months = useMemo(() => reportMonths(state, range, month), [state, range, month]);
  const incomeRows = useMemo(() => incomeVsSpending(state, months), [state, months]);
  const worthRows = useMemo(() => netWorth(state, months), [state, months]);

  const toggle = (value: GroupBy, label: string) => (
    <button
      type="button"
      onClick={() => setGroupBy(value)}
      aria-pressed={groupBy === value}
      className={`px-3 py-1.5 text-sm ${groupBy === value ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="rounded px-2 py-1 hover:bg-slate-200">‹</button>
          <h2 className="min-w-44 text-center text-lg font-semibold">{formatMonth(month)}</h2>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="rounded px-2 py-1 hover:bg-slate-200">›</button>
        </div>
        <div className="inline-flex overflow-hidden rounded border border-slate-300" role="group" aria-label="Group spending by">
          {toggle('category', 'By category')}
          {toggle('group', 'By group')}
        </div>
      </div>

      {uncategorized > 0 && (
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
          {uncategorized} outflow{uncategorized === 1 ? '' : 's'} this year {uncategorized === 1 ? 'has' : 'have'} no category and
          {uncategorized === 1 ? ' is' : ' are'} not shown. Edit {uncategorized === 1 ? 'it' : 'them'} on the Transactions tab to assign one.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {reports.map((report) => {
          const { title, subtitle, totalLabel } = titleFor(report);
          return (
            <article key={report.kind} className="rounded-lg bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-xs text-slate-500">{subtitle}</p>
              {report.slices.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">No spending in this period.</p>
              ) : (
                <>
                  <p className="mt-3 text-3xl font-semibold tabular-nums">
                    {formatMoney(report.total, currency)} <span className="text-sm font-normal text-slate-500">{totalLabel}</span>
                  </p>
                  <div className="mt-4">
                    <PieChart
                      slices={report.slices}
                      total={report.total}
                      currency={currency}
                      colors={colors}
                      label={`${title}: spending ${groupBy === 'group' ? 'by group' : 'by category'}, ${subtitle}`}
                    />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Over time</h2>
          <p className="text-xs text-slate-500">{formatMonthRange(months[0]!, months.at(-1)!)}</p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <IncomeSpendingChart rows={incomeRows} currency={currency} />
        <NetWorthChart rows={worthRows} currency={currency} />
      </div>
    </section>
  );
}
