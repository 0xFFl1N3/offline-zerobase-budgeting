import type { BudgetState } from './types.ts';

/**
 * Removes categories together with their goals and assignments. Their transactions are kept but become
 * uncategorized, so account balances never change; the categories' combined balance returns to Ready to Assign.
 */
export function removeCategories(state: BudgetState, categoryIds: string[]): BudgetState {
  const gone = new Set(categoryIds);
  return {
    ...state,
    categories: state.categories.filter((c) => !gone.has(c.id)),
    goals: state.goals.filter((g) => !gone.has(g.categoryId)),
    monthlyBudgets: state.monthlyBudgets.filter((b) => !gone.has(b.categoryId)),
    transactions: state.transactions.map((t) => (t.categoryId !== null && gone.has(t.categoryId) ? { ...t, categoryId: null } : t)),
  };
}

/** Removes a group and all of its categories (see removeCategories). */
export function removeGroup(state: BudgetState, groupId: string): BudgetState {
  const ids = state.categories.filter((c) => c.groupId === groupId).map((c) => c.id);
  const next = removeCategories(state, ids);
  return { ...next, groups: next.groups.filter((g) => g.id !== groupId) };
}
