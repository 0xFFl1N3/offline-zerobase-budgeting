import type { BudgetState, Cents, Goal, GoalProgress, Month, Transaction, TransactionSplit } from './types.ts';
import { addMonths, monthOf, monthsBetween } from './months.ts';

/** The category shares of a transaction: its splits, or the whole amount in its one category. Empty for transfers and income. */
export function categoryParts(t: Transaction): TransactionSplit[] {
  if (t.transferAccountId !== null) return [];
  if (t.splits && t.splits.length > 0) return t.splits;
  return t.categoryId !== null ? [{ categoryId: t.categoryId, amount: t.amount }] : [];
}

/** True if any part of the transaction belongs to one of the categories. */
export const touchesCategory = (t: Transaction, categoryIds: Iterable<string>): boolean => {
  const ids = new Set(categoryIds);
  return categoryParts(t).some((p) => ids.has(p.categoryId));
};

/** Balance of one account, counting transactions up to and including `upToMonth` (all if omitted). */
export function accountBalance(state: BudgetState, accountId: string, upToMonth?: Month): Cents {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error(`Unknown account: ${accountId}`);
  let balance = account.openingBalance;
  for (const t of state.transactions) {
    if (upToMonth !== undefined && monthOf(t.date) > upToMonth) continue;
    if (t.accountId === accountId) balance += t.amount;
    if (t.transferAccountId === accountId) balance -= t.amount;
  }
  return balance;
}

/**
 * The balance of an account after each of its transactions (transfers count on both sides), keyed by transaction id.
 * Transactions on the same day are taken in the order they were entered.
 */
export function runningBalances(state: BudgetState, accountId: string): Map<string, Cents> {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error(`Unknown account: ${accountId}`);
  const own = state.transactions
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => t.accountId === accountId || t.transferAccountId === accountId)
    .sort((a, b) => (a.t.date === b.t.date ? a.index - b.index : a.t.date < b.t.date ? -1 : 1));
  const result = new Map<string, Cents>();
  let balance = account.openingBalance;
  for (const { t } of own) {
    balance += t.accountId === accountId ? t.amount : -t.amount;
    result.set(t.id, balance);
  }
  return result;
}

export function categoryAssigned(state: BudgetState, categoryId: string, month: Month): Cents {
  return state.monthlyBudgets
    .filter((b) => b.categoryId === categoryId && b.month === month)
    .reduce((sum, b) => sum + b.assigned, 0);
}

/** Sum of the category's transactions in one month (negative = spending). */
export function categoryActivity(state: BudgetState, categoryId: string, month: Month): Cents {
  let total = 0;
  for (const t of state.transactions) {
    if (monthOf(t.date) !== month) continue;
    for (const part of categoryParts(t)) if (part.categoryId === categoryId) total += part.amount;
  }
  return total;
}

/** Category balance at the end of `month`: everything assigned and spent up to then (unspent money rolls over). */
export function categoryAvailable(state: BudgetState, categoryId: string, month: Month): Cents {
  let total = 0;
  for (const b of state.monthlyBudgets) {
    if (b.categoryId === categoryId && b.month <= month) total += b.assigned;
  }
  for (const t of state.transactions) {
    if (monthOf(t.date) > month) continue;
    for (const part of categoryParts(t)) if (part.categoryId === categoryId) total += part.amount;
  }
  return total;
}

export const isOverspent = (state: BudgetState, categoryId: string, month: Month): boolean =>
  categoryAvailable(state, categoryId, month) < 0;

/** Categories that are archived, directly or through their group. */
export function archivedCategoryIds(state: BudgetState): Set<string> {
  const archivedGroups = new Set(state.groups.filter((g) => g.archived).map((g) => g.id));
  return new Set(state.categories.filter((c) => c.archived || archivedGroups.has(c.groupId)).map((c) => c.id));
}

/**
 * Ready to Assign = all account balances minus the balances of all active categories, as of the end of `month`.
 * Archived categories do not count, so their remaining balance (or shortfall) flows back to Ready to Assign.
 */
export function readyToAssign(state: BudgetState, month: Month): Cents {
  const archived = archivedCategoryIds(state);
  let total = 0;
  for (const a of state.accounts) total += accountBalance(state, a.id, month);
  for (const b of state.monthlyBudgets) {
    if (b.month <= month && !archived.has(b.categoryId)) total -= b.assigned;
  }
  for (const t of state.transactions) {
    if (monthOf(t.date) > month) continue;
    for (const part of categoryParts(t)) if (!archived.has(part.categoryId)) total -= part.amount;
  }
  return total;
}

const clampPercent = (current: Cents, target: Cents): number => {
  if (target <= 0) return 0;
  const pct = Math.min(100, Math.max(0, (current / target) * 100));
  return Math.round(pct * 10) / 10;
};

function balanceGoalProgress(
  state: BudgetState,
  goal: Goal,
  target: Cents,
  targetDate: Month | undefined,
  month: Month,
): GoalProgress {
  const available = categoryAvailable(state, goal.categoryId, month);
  let neededThisMonth: Cents;
  if (targetDate === undefined) {
    neededThisMonth = Math.max(0, target - available);
  } else {
    const monthsLeft = Math.max(1, monthsBetween(month, targetDate) + 1);
    const availableBefore = categoryAvailable(state, goal.categoryId, addMonths(month, -1));
    const monthly = Math.ceil(Math.max(0, target - availableBefore) / monthsLeft);
    // This month's share, minus what already sits in the category from this month. Spending
    // (negative activity) from the category therefore raises the amount still needed.
    const addedThisMonth = categoryAssigned(state, goal.categoryId, month) + categoryActivity(state, goal.categoryId, month);
    neededThisMonth = Math.max(0, monthly - addedThisMonth);
  }
  return { goalId: goal.id, target, current: available, percent: clampPercent(available, target), neededThisMonth };
}

export function goalProgress(state: BudgetState, goal: Goal, month: Month): GoalProgress {
  switch (goal.type) {
    case 'target_balance':
      return balanceGoalProgress(state, goal, goal.targetAmount ?? 0, goal.targetDate, month);
    case 'monthly_amount': {
      const target = goal.monthlyAmount ?? 0;
      const assigned = categoryAssigned(state, goal.categoryId, month);
      return {
        goalId: goal.id,
        target,
        current: assigned,
        percent: clampPercent(assigned, target),
        neededThisMonth: Math.max(0, target - assigned),
      };
    }
  }
}
