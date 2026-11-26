import { useMemo, useState } from 'react';
import { spendingReport, type GroupBy, type ReportKind, type SpendingReport } from '../../engine/analytics.ts';
import { formatMoney } from '../../engine/money.ts';
import { formatMonth, formatMonthRange } from '../../engine/months.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { monthsAsDates, useNavigation } from '../../store/navigation.ts';
import { biggestCategory, incomeVsSpending, netWorth, reportMonths, spendingTrend, topPayees, type RangeKey, type TrendTarget } from '../../engine/reports.ts';
import { t } from '../../i18n/i18n.ts';
import { useIsDark } from '../../theme.ts';
import { AgeOfMoneyCard } from './AgeOfMoneyCard.tsx';
import { buildColorMap } from './colors.ts';
import { IncomeSpendingChart } from './IncomeSpendingChart.tsx';
import { NetWorthChart } from './NetWorthChart.tsx';
import { PieChart } from './PieChart.tsx';
import { RangeSwitch } from './RangeSwitch.tsx';
import { TopPayees } from './TopPayees.tsx';
import { TrendChart } from './TrendChart.tsx';

const KINDS: ReportKind[] = ['month', 'year-to-date', 'monthly-average'];

function titleFor(report: SpendingReport): { title: string; subtitle: string; totalLabel: string } {
  switch (report.kind) {
    case 'month':
      return { title: t('analytics.thisMonth'), subtitle: formatMonth(report.toMonth), totalLabel: t('analytics.spent') };
    case 'year-to-date':
      return { title: t('analytics.yearToDate'), subtitle: formatMonthRange(report.fromMonth, report.toMonth), totalLabel: t('analytics.spent') };
    case 'monthly-average':
      return {
        title: t('analytics.monthlyAverage'),
        subtitle: t('analytics.monthsWithData', { range: formatMonthRange(report.fromMonth, report.toMonth), count: report.divisor }),
        totalLabel: t('analytics.perMonth'),
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
  // Until a category is picked, the trend shows the one with the most spending in the range.
  const [pickedTrend, setPickedTrend] = useState<TrendTarget | null>(null);
  const trendTarget = useMemo<TrendTarget | null>(() => {
    if (pickedTrend) return pickedTrend;
    const id = biggestCategory(state, months);
    return id ? { kind: 'category', id } : null;
  }, [pickedTrend, state, months]);
  const payees = useMemo(() => topPayees(state, months), [state, months]);
  const showTransactions = useNavigation((s) => s.showTransactions);
  const trendRows = useMemo(() => (trendTarget ? spendingTrend(state, months, trendTarget) : []), [state, months, trendTarget]);

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
          <button type="button" aria-label={t('budget.prevMonth')} onClick={() => shiftMonth(-1)} className="rounded px-2 py-1 hover:bg-slate-200">‹</button>
          <h2 className="min-w-44 text-center text-lg font-semibold">{formatMonth(month)}</h2>
          <button type="button" aria-label={t('budget.nextMonth')} onClick={() => shiftMonth(1)} className="rounded px-2 py-1 hover:bg-slate-200">›</button>
        </div>
        <div className="inline-flex overflow-hidden rounded border border-slate-300" role="group" aria-label={t('analytics.groupBy')}>
          {toggle('category', t('analytics.byCategory'))}
          {toggle('group', t('analytics.byGroup'))}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">{t('analytics.clickHint')}</p>

      {uncategorized > 0 && (
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
          {t('analytics.uncategorized', { count: uncategorized })}
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
                <p className="mt-6 text-sm text-slate-500">{t('analytics.noSpending')}</p>
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
                      label={t('analytics.pieLabel', { title, by: t(groupBy === 'group' ? 'analytics.byGroupLower' : 'analytics.byCategoryLower'), subtitle })}
                      onPick={(slice) =>
                        showTransactions({ category: `${groupBy === 'group' ? 'group' : 'cat'}:${slice.id}`, ...monthsAsDates(report.fromMonth, report.toMonth) })
                      }
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
          <h2 className="text-lg font-semibold">{t('analytics.overTime')}</h2>
          <p className="text-xs text-slate-500">{formatMonthRange(months[0]!, months.at(-1)!)}</p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <IncomeSpendingChart rows={incomeRows} currency={currency} />
        <NetWorthChart rows={worthRows} currency={currency} />
        <TrendChart state={state} target={trendTarget} onTarget={setPickedTrend} rows={trendRows} currency={currency} />
        <TopPayees data={payees} currency={currency} onPick={(payee) => showTransactions({ search: payee, ...monthsAsDates(months[0]!, months.at(-1)!) })} />
        <AgeOfMoneyCard state={state} months={months} currency={currency} />
      </div>
    </section>
  );
}
