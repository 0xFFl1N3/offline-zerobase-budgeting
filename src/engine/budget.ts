import type { Account, BudgetState, Cents, Goal, GoalProgress, Month, Transaction, TransactionSplit } from './types.ts';
import { addMonths, monthOf, monthsBetween } from './months.ts';
import { RuleError } from './ruleError.ts';

/**
 * The category shares of a transaction: its splits, or the whole amount in its one category. Empty for income and
 * for transfers, except a debt payment (a transfer with a category), which is spending from that category.
 */
export function categoryParts(t: Pick<Transaction, 'transferAccountId' | 'splits' | 'categoryId' | 'amount'>): TransactionSplit[] {
  if (t.transferAccountId !== null) return t.categoryId !== null ? [{ categoryId: t.categoryId, amount: t.amount }] : [];
  if (t.splits && t.splits.length > 0) return t.splits;
  return t.categoryId !== null ? [{ categoryId: t.categoryId, amount: t.amount }] : [];
}

/** True if any part of the transaction belongs to one of the categories. */
export const touchesCategory = (t: Pick<Transaction, 'transferAccountId' | 'splits' | 'categoryId' | 'amount'>, categoryIds: Iterable<string>): boolean => {
  const ids = new Set(categoryIds);
  return categoryParts(t).some((p) => ids.has(p.categoryId));
};

export const isDebt = (account: Pick<Account, 'type'>): boolean => account.type === 'debt';

/** The accounts whose money is budgeted (everything but debts). */
export const budgetAccounts = (state: BudgetState): Account[] => state.accounts.filter((a) => !isDebt(a));

/** Balance of one account, counting transactions up to and including `upToMonth` (all if omitted). */
export function accountBalance(state: BudgetState, accountId: string, upToMonth?: Month): Cents {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) throw new RuleError(`Unknown account: ${accountId}`);
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
  if (!account) throw new RuleError(`Unknown account: ${accountId}`);
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

/** Assigned plus activity per month, for each category in `ids` (or all), in one pass over the data. */
function monthlyNet(state: BudgetState, ids?: Set<string>): Map<string, Map<Month, Cents>> {
  const result = new Map<string, Map<Month, Cents>>();
  const add = (categoryId: string, month: Month, amount: Cents) => {
    if (ids && !ids.has(categoryId)) return;
    let months = result.get(categoryId);
    if (!months) result.set(categoryId, (months = new Map()));
    months.set(month, (months.get(month) ?? 0) + amount);
  };
  for (const b of state.monthlyBudgets) add(b.categoryId, b.month, b.assigned);
  for (const t of state.transactions) {
    const m = monthOf(t.date);
    for (const part of categoryParts(t)) add(part.categoryId, m, part.amount);
  }
  return result;
}

/**
 * The balance at the end of `month`, YNAB style: money left over rolls into the next month, but an overspent
 * (negative) balance does not. The category starts the next month at zero and the shortfall comes out of
 * Ready to Assign instead (see readyToAssign).
 */
function availableFrom(net: Map<Month, Cents> | undefined, month: Month): Cents {
  if (!net) return 0;
  const months = [...net.keys()].filter((m) => m <= month).sort();
  let available = 0;
  for (const m of months) available = Math.max(0, available) + net.get(m)!;
  const last = months.at(-1);
  return last !== undefined && last < month ? Math.max(0, available) : available;
}

/** Category balance at the end of `month`. Unspent money rolls over; overspending is cleared at the next month. */
export function categoryAvailable(state: BudgetState, categoryId: string, month: Month): Cents {
  return availableFrom(monthlyNet(state, new Set([categoryId])).get(categoryId), month);
}

export const isOverspent = (state: BudgetState, categoryId: string, month: Month): boolean =>
  categoryAvailable(state, categoryId, month) < 0;

/** Categories that are archived, directly or through their group. */
export function archivedCategoryIds(state: BudgetState): Set<string> {
  const archivedGroups = new Set(state.groups.filter((g) => g.archived).map((g) => g.id));
  return new Set(state.categories.filter((c) => c.archived || archivedGroups.has(c.groupId)).map((c) => c.id));
}

/**
 * Ready to Assign = all budget account balances (not debts) minus the balances of all active categories, as of the end of `month`.
 * Archived categories do not count, so their remaining balance (or shortfall) flows back to Ready to Assign.
 * Because an overspent category starts the next month at zero, last month's overspending is taken from here.
 */
export function readyToAssign(state: BudgetState, month: Month): Cents {
  const archived = archivedCategoryIds(state);
  const active = new Set(state.categories.filter((c) => !archived.has(c.id)).map((c) => c.id));
  let total = 0;
  // Debts are outside the budget: only money in budget accounts can be assigned.
  for (const a of budgetAccounts(state)) total += accountBalance(state, a.id, month);
  for (const [, net] of monthlyNet(state, active)) total -= availableFrom(net, month);
  return total;
}

/** How much active categories were overspent at the end of `month` (a negative amount, or 0). */
export function overspentIn(state: BudgetState, month: Month): Cents {
  const archived = archivedCategoryIds(state);
  const active = new Set(state.categories.filter((c) => !archived.has(c.id)).map((c) => c.id));
  let total = 0;
  for (const [, net] of monthlyNet(state, active)) total += Math.min(0, availableFrom(net, month));
  return total;
}

const clampPercent = (current: Cents, target: Cents): number => {
  if (target <= 0) return 0;
  const pct = Math.min(100, Math.max(0, (current / target) * 100));
  return Math.round(pct * 10) / 10;
};

/**
 * The due month a dated goal aims at in `month`: its date, or for a repeating goal the first due month from `month`
 * on (the month of a due date itself still aims at it; the next round starts the month after).
 */
export function dueMonth(goal: Goal, month: Month): Month | undefined {
  if (!goal.targetDate) return undefined;
  if (!goal.repeatMonths || goal.targetDate >= month) return goal.targetDate;
  const rounds = Math.ceil(monthsBetween(goal.targetDate, month) / goal.repeatMonths);
  return addMonths(goal.targetDate, rounds * goal.repeatMonths);
}

/**
 * "Save up to an amount". Without a date: what is missing from the balance now (it refills after spending). With a
 * date: in the due month the category has to hold the amount. Until then what is missing is spread over the months
 * left, and spending from the category before the due month has to be made up. In the due month, what counts is
 * whether the money was there before that month's spending took it (the bill). After the due month a one-time goal
 * that was met asks for nothing more; one that was not keeps asking for what was missing.
 */
function balanceGoalProgress(state: BudgetState, goal: Goal, target: Cents, month: Month): GoalProgress {
  const id = goal.categoryId;
  const available = categoryAvailable(state, id, month);
  const due = dueMonth(goal, month);
  const progress = (current: Cents, neededThisMonth: Cents, pastDue = false): GoalProgress => ({
    goalId: goal.id, target, current, percent: clampPercent(current, target), neededThisMonth: Math.max(0, neededThisMonth),
    ...(due ? { dueMonth: due } : {}),
    ...(pastDue ? { pastDue: true as const } : {}),
  });
  if (due === undefined) return progress(available, target - available);

  /** What the category holds at the start of a month: last month's balance, overspending cleared. */
  const startOf = (m: Month) => Math.max(0, categoryAvailable(state, id, addMonths(m, -1)));
  /** What the category held in its due month before that month's spending. */
  const fundedIn = (m: Month) => startOf(m) + categoryAssigned(state, id, m);

  if (month > due) {
    // Only a one-time goal gets here: a repeating one has already moved on to its next due month.
    const funded = fundedIn(due);
    if (funded >= target) return progress(target, 0, true);
    let assignedSince = 0;
    for (let m = addMonths(due, 1); m <= month; m = addMonths(m, 1)) assignedSince += categoryAssigned(state, id, m);
    return progress(funded + assignedSince, target - funded - assignedSince, true);
  }
  if (month === due) {
    const funded = fundedIn(due);
    return progress(funded, target - funded);
  }
  const monthsLeft = monthsBetween(month, due) + 1;
  const monthly = Math.ceil(Math.max(0, target - startOf(month)) / monthsLeft);
  // This month's share, minus what already went in this month. Spending from the category before the due month
  // (negative activity) has to be made up, so it raises what is still needed.
  const addedThisMonth = categoryAssigned(state, id, month) + categoryActivity(state, id, month);
  return progress(available, monthly - addedThisMonth);
}

export function goalProgress(state: BudgetState, goal: Goal, month: Month): GoalProgress {
  switch (goal.type) {
    case 'target_balance':
      return balanceGoalProgress(state, goal, goal.targetAmount ?? 0, month);
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
