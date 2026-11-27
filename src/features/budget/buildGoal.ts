import type { Cents, Goal, GoalType, RepeatMonths } from '../../engine/types.ts';
import type { MessageKey } from '../../i18n/en.ts';

/** What the goal editor holds. For monthly_amount, `amount` is the monthly amount. */
export interface GoalForm {
  type: GoalType;
  amount: Cents;
  /** 'YYYY-MM' or '' */
  targetDate: string;
  /** Only with a targetDate; ignored without one. */
  repeatMonths?: RepeatMonths | null;
}

/** `error` is the text to show, as a key of the translations. */
export type BuildGoalResult = { ok: true; goal: Goal } | { ok: false; error: MessageKey };

const MONTH = /^\d{4}-\d{2}$/;

export function buildGoal(form: GoalForm, categoryId: string, id: string): BuildGoalResult {
  if (!(form.amount > 0)) return { ok: false, error: 'goal.errorPositive' };
  const date = form.targetDate.trim();

  switch (form.type) {
    case 'monthly_amount':
      return { ok: true, goal: { id, categoryId, type: 'monthly_amount', monthlyAmount: form.amount } };
    case 'target_balance':
      if (date !== '' && !MONTH.test(date)) return { ok: false, error: 'goal.errorMonth' };
      return {
        ok: true,
        goal: {
          id,
          categoryId,
          type: 'target_balance',
          targetAmount: form.amount,
          ...(date !== '' ? { targetDate: date } : {}),
          ...(date !== '' && form.repeatMonths ? { repeatMonths: form.repeatMonths } : {}),
        },
      };
  }
}

export function goalToForm(goal: Goal): GoalForm {
  return {
    type: goal.type,
    amount: (goal.type === 'monthly_amount' ? goal.monthlyAmount : goal.targetAmount) ?? 0,
    targetDate: goal.targetDate ?? '',
    ...(goal.repeatMonths ? { repeatMonths: goal.repeatMonths } : {}),
  };
}
