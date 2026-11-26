import type { BudgetState } from './types.ts';

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
