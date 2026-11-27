import { useState } from 'react';
import { Dialog } from '../../components/Dialog.tsx';
import { accountBalance } from '../../engine/budget.ts';
import { nextPaymentMonth, owedHistory, payoffForecast, plannedPayment, type PayoffForecast } from '../../engine/debt.ts';
import { formatMoney, parseMoney, toAmountInput } from '../../engine/money.ts';
import { formatMonth, toISODate } from '../../engine/months.ts';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { DataTable } from '../analytics/ChartFrame.tsx';
import { SERIES_COLORS } from '../analytics/colors.ts';
import { LineChart } from '../analytics/LineChart.tsx';

/** One line about when a debt is paid off, e.g. "17 payments; the last, €20.00, in April 2028". */
export function forecastText(f: PayoffForecast, fmt: (c: number) => string): string {
  if (f.payments === 0) return t('debt.paidOff');
  return t('debt.forecast', { count: f.payments, amount: fmt(f.lastAmount), month: formatMonth(f.lastMonth) });
}

/** What is owed, when it will be paid off, a calculator to try other amounts, and the payoff so far. */
export function DebtDialog({ debtId, onClose }: { debtId: string; onClose: () => void }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const fmt = (c: number) => formatMoney(c, currency);
  const debt = state.accounts.find((a) => a.id === debtId);
  const planned = debt ? plannedPayment(state, debt) : null;
  const [monthlyText, setMonthlyText] = useState(planned ? toAmountInput(planned) : '');
  const [extraText, setExtraText] = useState('');
  if (!debt) return null;

  const today = toISODate();
  const owed = -accountBalance(state, debt.id);
  const first = nextPaymentMonth(state, debt, today);
  const plan = planned ? payoffForecast(owed, planned, first) : null;
  const monthly = parseMoney(monthlyText);
  const extra = extraText.trim() === '' ? 0 : parseMoney(extraText);
  const tried = monthly !== null && monthly > 0 && extra !== null ? payoffForecast(owed, monthly, first, Math.abs(extra)) : null;
  const sooner = plan && tried ? plan.payments - tried.payments : 0;
  const history = owedHistory(state, debt, today.slice(0, 7));
  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums';

  return (
    <Dialog title={debt.name} onClose={onClose} wide>
      <p className="text-lg font-semibold tabular-nums">
        {owed > 0 ? t('debt.stillOwed', { amount: fmt(owed) }) : owed === 0 ? t('debt.paidOff') : t('debt.overpaid', { amount: fmt(-owed) })}
      </p>
      {owed > 0 && (
        <p className="mt-1 text-slate-700">
          {plan ? `${t('debt.withPlan', { amount: fmt(planned!) })} ${forecastText(plan, fmt)}` : t('debt.noPlan')}
        </p>
      )}

      {owed > 0 && (
        <section className="mt-5 rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold">{t('debt.tryTitle')}</h3>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600">
              {t('debt.tryMonthly')}
              <input value={monthlyText} onChange={(e) => setMonthlyText(e.target.value)} inputMode="decimal" className={`${field} mt-1 block w-28`} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              {t('debt.tryExtra')}
              <input value={extraText} onChange={(e) => setExtraText(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${field} mt-1 block w-28`} />
            </label>
          </div>
          <p className="mt-3 text-slate-700" aria-live="polite">
            {tried ? forecastText(tried, fmt) : t('debt.tryInvalid')}
            {tried && sooner > 0 && <span className="text-emerald-700"> {t('debt.sooner', { count: sooner })}</span>}
            {tried && sooner < 0 && <span className="text-amber-700"> {t('debt.later', { count: -sooner })}</span>}
          </p>
        </section>
      )}

      {history.length > 1 && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold">{t('debt.history')}</h3>
          <div className="mt-2">
            <LineChart rows={history} currency={currency} color={SERIES_COLORS[0]} label={t('debt.historyLabel', { name: debt.name })} describe={(r) => `${formatMonth(r.month)}: ${fmt(r.value)}`} />
          </div>
          <DataTable head={[t('analytics.month'), t('debt.owedColumn')]} rows={history.map((r) => [formatMonth(r.month), fmt(r.value)])} />
        </section>
      )}
    </Dialog>
  );
}
