import type { ReactNode } from 'react';
import { Dialog } from '../../components/Dialog.tsx';
import { monthSummary } from '../../engine/budget.ts';
import { formatMoney, type Currency } from '../../engine/money.ts';
import { addMonths, formatMonth } from '../../engine/months.ts';
import { netWorth } from '../../engine/reports.ts';
import type { BudgetState, Month } from '../../engine/types.ts';
import { t } from '../../i18n/i18n.ts';

interface Props {
  state: BudgetState;
  month: Month;
  currency: Currency;
  /** What Fund goals would assign this month. */
  goalsNeed: number;
  onFundGoals: () => void;
  onClose: () => void;
}

/** What makes up this month's Ready to Assign, and what happened in the categories. Opened from the pill. */
export function MonthOverview({ state, month, currency, goalsNeed, onFundGoals, onClose }: Props) {
  const s = monthSummary(state, month);
  const fmt = (c: number) => formatMoney(c, currency);
  const signed = (c: number) => (c > 0 ? `+${fmt(c)}` : fmt(c));
  const last = formatMonth(addMonths(month, -1));
  const now = formatMonth(month);
  const row = (label: ReactNode, value: ReactNode, tone = '') => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
  return (
    <Dialog title={t('summary.title', { month: now })} onClose={onClose}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('summary.howTitle')}</h3>
      <dl className="mt-1">
        {row(t('summary.fromLast', { month: last }), fmt(s.fromLastMonth))}
        {s.overspentLastMonth < 0 && row(t('summary.overspent', { month: last }), fmt(s.overspentLastMonth), 'text-red-600')}
        {row(t('summary.income', { month: now }), signed(s.income))}
        {row(t('summary.assigned', { month: now }), signed(-s.assigned))}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2 font-semibold">
          <dt>{t('budget.readyToAssign')}</dt>
          <dd className={`tabular-nums ${s.readyToAssign < 0 ? 'text-red-600' : ''}`}>{fmt(s.readyToAssign)}</dd>
        </div>
      </dl>
      {s.overspentLastMonth < 0 && <p className="mt-1 text-xs text-slate-500">{t('summary.overspentHint', { month: last })}</p>}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('summary.categoriesTitle', { month: now })}</h3>
      <dl className="mt-1">
        {row(t('summary.spent'), fmt(s.spent))}
        {row(t('summary.available'), fmt(s.available), s.available < 0 ? 'text-red-600' : '')}
        {row(
          t('summary.goalsNeed'),
          goalsNeed > 0 ? (
            <span className="flex items-baseline gap-3">
              <button
                type="button"
                onClick={() => {
                  onFundGoals();
                  onClose();
                }}
                className="text-xs font-medium text-sky-700 hover:underline"
              >
                {t('assign.goals')}
              </button>
              {fmt(goalsNeed)}
            </span>
          ) : (
            <span className="text-emerald-700">{t('summary.goalsDone')}</span>
          ),
        )}
      </dl>

      <dl className="mt-4 border-t border-slate-200 pt-2">{row(t('summary.netWorth'), fmt(netWorth(state, [month])[0]?.value ?? 0))}</dl>
    </Dialog>
  );
}
