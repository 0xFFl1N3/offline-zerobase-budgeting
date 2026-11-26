import type { BudgetState } from './types.ts';

/**
 * Removes categories together with their goals and assignments. Their transactions are moved to `moveTo`,
 * so no spending is left without a category and account balances never change. The deleted categories'
 * assigned money returns to Ready to Assign. `moveTo` is required when any of them has an outflow.
 */
export function removeCategories(state: BudgetState, categoryIds: string[], moveTo: string | null = null): BudgetState {
  const gone = new Set(categoryIds);
  if (moveTo !== null) {
    if (gone.has(moveTo)) throw new Error('Transactions cannot be moved into a category that is being deleted.');
    if (!state.categories.some((c) => c.id === moveTo)) throw new Error('The target category does not exist.');
  }
  const affected = state.transactions.filter((t) => t.categoryId !== null && gone.has(t.categoryId));
  if (moveTo === null && affected.some((t) => t.amount < 0)) {
    throw new Error('Spending in a deleted category must be moved to another category.');
  }
  return {
    ...state,
    categories: state.categories.filter((c) => !gone.has(c.id)),
    goals: state.goals.filter((g) => !gone.has(g.categoryId)),
    monthlyBudgets: state.monthlyBudgets.filter((b) => !gone.has(b.categoryId)),
    transactions: state.transactions.map((t) => (t.categoryId !== null && gone.has(t.categoryId) ? { ...t, categoryId: moveTo } : t)),
  };
}

/** Removes a group and all of its categories (see removeCategories). */
export function removeGroup(state: BudgetState, groupId: string, moveTo: string | null = null): BudgetState {
  const ids = state.categories.filter((c) => c.groupId === groupId).map((c) => c.id);
  const next = removeCategories(state, ids, moveTo);
  return { ...next, groups: next.groups.filter((g) => g.id !== groupId) };
}
