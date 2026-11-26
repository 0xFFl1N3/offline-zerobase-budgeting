import { goalProgress } from '../../engine/budget.ts';
import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { BudgetState, Goal, Month } from '../../engine/types.ts';
import { t } from '../../i18n/i18n.ts';

interface Props {
  state: BudgetState;
  goal: Goal;
  month: Month;
  currency: Currency;
}

export function GoalProgress({ state, goal, month, currency }: Props) {
  const p = goalProgress(state, goal, month);
  const fmt = (c: number) => formatMoney(c, currency);

  const amounts = { current: fmt(p.current), target: fmt(p.target) };
  const base =
    goal.type === 'monthly_amount'
      ? t('goal.monthlyProgress', amounts)
      : goal.targetDate
        ? t('goal.progressBy', { ...amounts, month: formatMonth(goal.targetDate) })
        : t('goal.progress', amounts);
  const status =
    p.neededThisMonth > 0 ? t('goal.assignMore', { amount: fmt(p.neededThisMonth) }) : p.percent >= 100 ? t('goal.funded') : t('goal.onTrack');
  const funded = p.neededThisMonth === 0;

  return (
    <div className="mt-0.5 max-w-md">
      <div className="h-1.5 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${funded ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${p.percent}%` }} />
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        {base} · <span className={funded ? 'text-emerald-700' : 'text-amber-700'}>{status}</span>
      </div>
    </div>
  );
}
