import { useState } from 'react';
import { Dialog } from '../../components/Dialog.tsx';
import { accountBalance, categoryAvailable } from '../../engine/budget.ts';
import { useNavigation } from '../../store/navigation.ts';
import { debtChange, nextPaymentMonth, owedHistory, payoffForecast, plannedPayment, type PayoffForecast } from '../../engine/debt.ts';
import { useAction } from '../errors/useAction.ts';
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
  const [raiseText, setRaiseText] = useState('');
  const [raiseMemo, setRaiseMemo] = useState('');
  const [correctText, setCorrectText] = useState('');
  const saveTransaction = useBudgetStore((s) => s.saveTransaction);
  const raise = useAction();
  const correct = useAction();
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
  const button = 'rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50';

  const owe = () => {
    const amount = parseMoney(raiseText);
    if (amount === null || amount <= 0) return raise.setError(t('debt.errorAmount'));
    const tx = debtChange(debt.id, amount, today, t('debt.raisePayee'), raiseMemo.trim(), crypto.randomUUID());
    void raise.run(() => saveTransaction(tx)).then((ok) => {
      if (!ok) return;
      setRaiseText('');
      setRaiseMemo('');
    });
  };
  // Opens the transaction form filled in: from the first budget account, what is set aside this month, else the minimum.
  const recordPayment = () => {
    const available = debt.paymentCategoryId ? categoryAvailable(state, debt.paymentCategoryId, today.slice(0, 7)) : 0;
    useNavigation.getState().newTransaction({
      kind: 'transfer',
      accountId: state.accounts.find((a) => !a.closed && a.type !== 'debt')?.id ?? '',
      transferAccountId: debt.id,
      categoryId: debt.paymentCategoryId ?? '',
      amount: available > 0 ? available : (debt.minimumPayment ?? 0),
    });
    onClose();
  };
  const correctTo = () => {
    const actual = parseMoney(correctText);
    if (actual === null || actual < 0) return correct.setError(t('debt.errorOwedAmount'));
    if (actual === owed) return setCorrectText('');
    const tx = debtChange(debt.id, actual - owed, today, t('debt.correctPayee'), '', crypto.randomUUID());
    void correct.run(() => saveTransaction(tx)).then((ok) => ok && setCorrectText(''));
  };

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
      {owed > 0 && debt.paymentCategoryId && (
        <button type="button" onClick={recordPayment} className="mt-3 rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
          {t('debt.recordPayment')}
        </button>
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

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold">{t('debt.raiseTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('debt.raiseHint')}</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              {t('debt.raiseAmount')}
              <input value={raiseText} onChange={(e) => setRaiseText(e.target.value)} inputMode="decimal" className={`${field} mt-1 block w-24`} />
            </label>
            <label className="min-w-32 flex-1 text-xs font-medium text-slate-600">
              {t('debt.raiseMemo')}
              <input value={raiseMemo} onChange={(e) => setRaiseMemo(e.target.value)} className={`${field} mt-1 block w-full text-left`} />
            </label>
            <button type="button" onClick={owe} className={button}>{t('debt.raiseButton')}</button>
          </div>
          {raise.error && <p className="mt-2 text-xs text-red-600">{raise.error}</p>}
        </section>
        <section className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold">{t('debt.correctTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('debt.correctHint')}</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              {t('debt.correctAmount')}
              <input value={correctText} onChange={(e) => setCorrectText(e.target.value)} inputMode="decimal" placeholder={toAmountInput(Math.max(0, owed))} className={`${field} mt-1 block w-28`} />
            </label>
            <button type="button" onClick={correctTo} className={button}>{t('debt.correctButton')}</button>
          </div>
          {correct.error && <p className="mt-2 text-xs text-red-600">{correct.error}</p>}
        </section>
      </div>

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
