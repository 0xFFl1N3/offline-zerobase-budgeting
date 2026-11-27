import { goalProgress } from '../../engine/budget.ts';
import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { BudgetState, Goal, Month } from '../../engine/types.ts';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

interface Props {
  state: BudgetState;
  goal: Goal;
  month: Month;
  currency: Currency;
}

export function GoalProgress({ state, goal, month, currency }: Props) {
  const p = goalProgress(state, goal, month);
  const fmt = (c: number) => formatMoney(c, currency);
  // A one-time goal after its due month: say whether it was met instead of showing a bar (the bill may have
  // emptied the category); DueGoalActions offers what comes next.
  if (p.pastDue && p.dueMonth) {
    const done = p.neededThisMonth === 0;
    return (
      <p className={`mt-0.5 text-xs font-medium ${done ? 'text-emerald-700' : 'text-amber-700'}`}>
        {done ? t('goal.dueDone', { month: formatMonth(p.dueMonth) }) : t('goal.dueMissing', { month: formatMonth(p.dueMonth), amount: fmt(p.neededThisMonth) })}
      </p>
    );
  }

  const amounts = { current: fmt(p.current), target: fmt(p.target) };
  const base =
    goal.type === 'monthly_amount'
      ? t('goal.monthlyProgress', amounts)
      : p.dueMonth
        ? t('goal.progressBy', { ...amounts, month: formatMonth(p.dueMonth) }) + (goal.repeatMonths ? ` · ${t(`goal.repeats${goal.repeatMonths}`)}` : '')
        : t('goal.keepProgress', amounts);
  const status = p.paused
    ? t('goal.pausedMonth')
    : p.neededThisMonth > 0 ? t('goal.assignMore', { amount: fmt(p.neededThisMonth) }) : p.percent >= 100 ? t('goal.funded') : t('goal.onTrack');
  const funded = p.neededThisMonth === 0 && !p.paused;
  const tone = p.paused ? 'text-slate-500' : funded ? 'text-emerald-700' : 'text-amber-700';

  return (
    <div className="mt-0.5 max-w-md">
      <div className="h-1.5 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${p.paused ? 'bg-slate-400' : funded ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${p.percent}%` }} />
      </div>
      {/* What is still needed sits at the right end of the bar, where the eye lands when scanning down the list. */}
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
        <span>{base}</span>
        <span className={`ml-auto ${tone}`}>{status}</span>
      </div>
    </div>
  );
}

/** What to do with a one-time goal once its due month has passed. Nothing for other goals. */
export function DueGoalActions({ state, goal, month, onNewGoal, className = '' }: { state: BudgetState; goal: Goal; month: Month; onNewGoal: () => void; className?: string }) {
  const saveGoal = useBudgetStore((s) => s.saveGoal);
  const removeGoal = useBudgetStore((s) => s.removeGoal);
  if (!goalProgress(state, goal, month).pastDue) return null;
  const link = 'rounded px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-50 hover:underline';
  return (
    <div className={`flex flex-wrap gap-x-1 ${className}`}>
      <button type="button" onClick={() => void saveGoal({ ...goal, repeatMonths: 12 })} className={link}>{t('goal.repeatYearly')}</button>
      <button type="button" onClick={onNewGoal} className={link}>{t('goal.newGoal')}</button>
      <button type="button" onClick={() => void removeGoal(goal.categoryId)} className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50">{t('goal.remove')}</button>
    </div>
  );
}
