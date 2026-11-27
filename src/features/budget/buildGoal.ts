import type { Cents, Goal, RepeatMonths } from '../../engine/types.ts';
import type { MessageKey } from '../../i18n/en.ts';

/**
 * The three kinds of goal the editor offers. Two are stored as the same goal type: "keep ready" is a target_balance
 * goal without a month, "save up by a month" one with a month.
 */
export type GoalKind = 'keep' | 'save_by' | 'monthly';
export const GOAL_KINDS: GoalKind[] = ['keep', 'save_by', 'monthly'];

/** What the goal editor holds. For 'monthly', `amount` is the monthly amount. */
export interface GoalForm {
  type: GoalKind;
  amount: Cents;
  /** 'YYYY-MM' or ''. Needed for 'save_by', ignored otherwise. */
  targetDate: string;
  /** Only for 'save_by'. */
  repeatMonths?: RepeatMonths | null;
}

/** `error` is the text to show, as a key of the translations. */
export type BuildGoalResult = { ok: true; goal: Goal } | { ok: false; error: MessageKey };

const MONTH = /^\d{4}-\d{2}$/;

export function buildGoal(form: GoalForm, categoryId: string, id: string): BuildGoalResult {
  if (!(form.amount > 0)) return { ok: false, error: 'goal.errorPositive' };
  const date = form.targetDate.trim();

  switch (form.type) {
    case 'monthly':
      return { ok: true, goal: { id, categoryId, type: 'monthly_amount', monthlyAmount: form.amount } };
    case 'keep':
      return { ok: true, goal: { id, categoryId, type: 'target_balance', targetAmount: form.amount } };
    case 'save_by':
      if (!MONTH.test(date)) return { ok: false, error: 'goal.errorMonth' };
      return {
        ok: true,
        goal: {
          id,
          categoryId,
          type: 'target_balance',
          targetAmount: form.amount,
          targetDate: date,
          ...(form.repeatMonths ? { repeatMonths: form.repeatMonths } : {}),
        },
      };
  }
}

export function goalToForm(goal: Goal): GoalForm {
  if (goal.type === 'monthly_amount') return { type: 'monthly', amount: goal.monthlyAmount ?? 0, targetDate: '' };
  if (!goal.targetDate) return { type: 'keep', amount: goal.targetAmount ?? 0, targetDate: '' };
  return {
    type: 'save_by',
    amount: goal.targetAmount ?? 0,
    targetDate: goal.targetDate,
    ...(goal.repeatMonths ? { repeatMonths: goal.repeatMonths } : {}),
  };
}
