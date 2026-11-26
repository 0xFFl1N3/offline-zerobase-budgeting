import type { Cents, Goal, GoalType } from '../../engine/types.ts';

/** What the goal editor holds. For monthly_amount, `amount` is the monthly amount. */
export interface GoalForm {
  type: GoalType;
  amount: Cents;
  /** 'YYYY-MM' or '' */
  targetDate: string;
}

export type BuildGoalResult = { ok: true; goal: Goal } | { ok: false; error: string };

const MONTH = /^\d{4}-\d{2}$/;

export function buildGoal(form: GoalForm, categoryId: string, id: string): BuildGoalResult {
  if (!(form.amount > 0)) return { ok: false, error: 'Enter an amount greater than zero.' };
  const date = form.targetDate.trim();

  switch (form.type) {
    case 'monthly_amount':
      return { ok: true, goal: { id, categoryId, type: 'monthly_amount', monthlyAmount: form.amount } };
    case 'target_balance':
      if (date !== '' && !MONTH.test(date)) return { ok: false, error: 'Pick a valid month.' };
      return {
        ok: true,
        goal: {
          id,
          categoryId,
          type: 'target_balance',
          targetAmount: form.amount,
          ...(date !== '' ? { targetDate: date } : {}),
        },
      };
    case 'target_by_date':
      if (!MONTH.test(date)) return { ok: false, error: 'Pick the month you want to reach the target by.' };
      return { ok: true, goal: { id, categoryId, type: 'target_by_date', targetAmount: form.amount, targetDate: date } };
  }
}

export function goalToForm(goal: Goal): GoalForm {
  return {
    type: goal.type,
    amount: (goal.type === 'monthly_amount' ? goal.monthlyAmount : goal.targetAmount) ?? 0,
    targetDate: goal.targetDate ?? '',
  };
}
