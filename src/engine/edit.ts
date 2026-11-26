import { accountBalance } from './budget.ts';
import type { AccountType, BudgetState, Cents } from './types.ts';

/**
 * Removes categories together with their goals and assignments. A category that has transactions cannot be
 * deleted (archive it instead), so past spending always keeps its category. The assigned money returns to
 * Ready to Assign.
 */
export function removeCategories(state: BudgetState, categoryIds: string[]): BudgetState {
  const gone = new Set(categoryIds);
  if (state.transactions.some((t) => t.categoryId !== null && gone.has(t.categoryId))) {
    throw new Error('A category with transactions cannot be deleted. Archive it instead.');
  }
  return {
    ...state,
    categories: state.categories.filter((c) => !gone.has(c.id)),
    goals: state.goals.filter((g) => !gone.has(g.categoryId)),
    monthlyBudgets: state.monthlyBudgets.filter((b) => !gone.has(b.categoryId)),
  };
}

/** Removes a group and all of its categories (see removeCategories). */
export function removeGroup(state: BudgetState, groupId: string): BudgetState {
  const ids = state.categories.filter((c) => c.groupId === groupId).map((c) => c.id);
  const next = removeCategories(state, ids);
  return { ...next, groups: next.groups.filter((g) => g.id !== groupId) };
}

/** Archives or restores one category. Restoring a category also restores its group. */
export function setCategoryArchived(state: BudgetState, categoryId: string, archived: boolean): BudgetState {
  const category = state.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error('Unknown category.');
  return {
    ...state,
    categories: state.categories.map((c) => (c.id === categoryId ? { ...c, archived } : c)),
    groups: archived ? state.groups : state.groups.map((g) => (g.id === category.groupId ? { ...g, archived: false } : g)),
  };
}

/** Archives or restores a group together with all of its categories. */
export function setGroupArchived(state: BudgetState, groupId: string, archived: boolean): BudgetState {
  if (!state.groups.some((g) => g.id === groupId)) throw new Error('Unknown group.');
  return {
    ...state,
    groups: state.groups.map((g) => (g.id === groupId ? { ...g, archived } : g)),
    categories: state.categories.map((c) => (c.groupId === groupId ? { ...c, archived } : c)),
  };
}

const hasTransactions = (state: BudgetState, accountId: string) =>
  state.transactions.some((t) => t.accountId === accountId || t.transferAccountId === accountId);

/** Changes an account's name, type or opening balance. The opening balance feeds Ready to Assign directly. */
export function updateAccount(
  state: BudgetState,
  accountId: string,
  changes: { name?: string; type?: AccountType; openingBalance?: Cents },
): BudgetState {
  if (!state.accounts.some((a) => a.id === accountId)) throw new Error('Unknown account.');
  if (changes.name !== undefined && !changes.name.trim()) throw new Error('An account needs a name.');
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === accountId
        ? {
            ...a,
            ...(changes.name !== undefined && { name: changes.name.trim() }),
            ...(changes.type !== undefined && { type: changes.type }),
            ...(changes.openingBalance !== undefined && { openingBalance: changes.openingBalance }),
          }
        : a,
    ),
  };
}

/** Closes or reopens an account. Closing needs a zero balance, so Ready to Assign is not affected. */
export function setAccountClosed(state: BudgetState, accountId: string, closed: boolean): BudgetState {
  if (!state.accounts.some((a) => a.id === accountId)) throw new Error('Unknown account.');
  if (closed && accountBalance(state, accountId) !== 0) {
    throw new Error('Move the remaining balance to another account before closing this one.');
  }
  return { ...state, accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, closed } : a)) };
}

/** Deletes an account. Refused when it has transactions (including transfers); close it instead. */
export function removeAccount(state: BudgetState, accountId: string): BudgetState {
  if (!state.accounts.some((a) => a.id === accountId)) throw new Error('Unknown account.');
  if (hasTransactions(state, accountId)) throw new Error('An account with transactions cannot be deleted. Close it instead.');
  return { ...state, accounts: state.accounts.filter((a) => a.id !== accountId) };
}
