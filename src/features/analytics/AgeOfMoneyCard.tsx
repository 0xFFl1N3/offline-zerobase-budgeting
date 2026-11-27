import { useMemo } from 'react';
import { ageHistory, ageOfMoney } from '../../engine/ageOfMoney.ts';
import type { Currency } from '../../engine/money.ts';
import { formatMonth, toISODate } from '../../engine/months.ts';
import type { BudgetState, Month } from '../../engine/types.ts';
import { t } from '../../i18n/i18n.ts';
import { DataTable } from './ChartFrame.tsx';
import { SERIES_COLORS } from './colors.ts';
import { LineChart } from './LineChart.tsx';

const daysText = (count: number) => t('analytics.ageDays', { count });

export function AgeOfMoneyCard({ state, months, currency }: { state: BudgetState; months: Month[]; currency: Currency }) {
  const today = toISODate();
  const now = useMemo(() => ageOfMoney(state, today), [state, today]);
  const monthAgo = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 1);
    return ageOfMoney(state, toISODate(d));
  }, [state, today]);
  const history = useMemo(
    () => ageHistory(state, months.filter((m) => m <= today.slice(0, 7)), today).filter((r): r is { month: Month; value: number } => r.value !== null),
    [state, months, today],
  );

  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold">{t('analytics.ageOfMoney')}</h3>
      <p className="text-xs text-slate-500">{t('analytics.ageHint')}</p>
      {now === null ? (
        <p className="mt-6 text-sm text-slate-500">{t('analytics.ageNotYet')}</p>
      ) : (
        <>
          <p className="mt-3 text-lg font-semibold tabular-nums">{daysText(now)}</p>
          {monthAgo !== null && <p className="text-sm text-slate-500">{t('analytics.ageMonthAgo', { days: daysText(monthAgo) })}</p>}
          {history.length > 1 && (
            <div className="mt-3">
              <LineChart
                rows={history}
                currency={currency}
                color={SERIES_COLORS[0]}
                label={t('analytics.ageLabel')}
                describe={(r) => `${formatMonth(r.month)}: ${daysText(r.value)}`}
                formatTick={(v) => t('analytics.ageTick', { count: v })}
              />
            </div>
          )}
          <DataTable head={[t('analytics.month'), t('analytics.ageOfMoney')]} rows={history.map((r) => [formatMonth(r.month), daysText(r.value)])} />
        </>
      )}
    </article>
  );
}
