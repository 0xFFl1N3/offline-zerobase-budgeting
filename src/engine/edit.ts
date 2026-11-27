import { accountBalance, touchesCategory } from './budget.ts';
import type { Account, AccountType, BudgetState, Category, CategoryGroup, Cents, Goal } from './types.ts';
import { RuleError } from './ruleError.ts';

/**
 * Removes categories together with their goals and assignments. A category that has transactions cannot be
 * deleted (archive it instead), so past spending always keeps its category. The assigned money returns to
 * Ready to Assign.
 */
export function removeCategories(state: BudgetState, categoryIds: string[]): BudgetState {
  const gone = new Set(categoryIds);
  if (state.accounts.some((a) => a.paymentCategoryId !== undefined && gone.has(a.paymentCategoryId))) {
    throw new RuleError("A debt's payment category cannot be deleted while the debt exists. Archive it instead.");
  }
  if (state.transactions.some((t) => touchesCategory(t, gone)) || state.recurring.some((r) => touchesCategory(r.template, gone))) {
    throw new RuleError('A category with transactions cannot be deleted. Archive it instead.');
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
  if (!category) throw new RuleError('Unknown category.');
  return {
    ...state,
    categories: state.categories.map((c) => (c.id === categoryId ? { ...c, archived } : c)),
    groups: archived ? state.groups : state.groups.map((g) => (g.id === category.groupId ? { ...g, archived: false } : g)),
  };
}

/** Archives or restores a group together with all of its categories. */
export function setGroupArchived(state: BudgetState, groupId: string, archived: boolean): BudgetState {
  if (!state.groups.some((g) => g.id === groupId)) throw new RuleError('Unknown group.');
  return {
    ...state,
    groups: state.groups.map((g) => (g.id === groupId ? { ...g, archived } : g)),
    categories: state.categories.map((c) => (c.groupId === groupId ? { ...c, archived } : c)),
  };
}

const hasTransactions = (state: BudgetState, accountId: string) =>
  state.transactions.some((t) => t.accountId === accountId || t.transferAccountId === accountId) ||
  state.recurring.some((r) => r.template.accountId === accountId || r.template.transferAccountId === accountId);

/** Changes an account's name, type or opening balance. The opening balance feeds Ready to Assign directly. */
export function updateAccount(
  state: BudgetState,
  accountId: string,
  changes: { name?: string; type?: AccountType; openingBalance?: Cents; minimumPayment?: Cents | null },
): BudgetState {
  if (!state.accounts.some((a) => a.id === accountId)) throw new RuleError('Unknown account.');
  if (changes.name !== undefined && !changes.name.trim()) throw new RuleError('An account needs a name.');
  const account = state.accounts.find((a) => a.id === accountId)!;
  if (changes.type !== undefined && (changes.type === 'debt') !== (account.type === 'debt')) {
    throw new RuleError('A debt cannot be changed into another kind of account, or the other way round.');
  }
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === accountId
        ? {
            ...a,
            ...(changes.name !== undefined && { name: changes.name.trim() }),
            ...(changes.type !== undefined && { type: changes.type }),
            ...(changes.openingBalance !== undefined && { openingBalance: changes.openingBalance }),
            ...(changes.minimumPayment !== undefined && { minimumPayment: changes.minimumPayment ?? undefined }),
          }
        : a,
    ),
  };
}

export interface NewDebt {
  name: string;
  /** What is still to be paid back, interest included (positive). */
  owed: Cents;
  /** Optional agreed minimum monthly payment (positive). */
  minimumPayment: Cents | null;
  /** Name for the category group of debt payments, if it has to be created (in the user's language). */
  groupName: string;
}

export interface DebtSetup {
  state: BudgetState;
  account: Account;
  /** Only when a new group was needed. */
  group: CategoryGroup | null;
  category: Category;
  goal: Goal | null;
}

/**
 * Adds a debt account together with its payment category (in the group of existing debt payments, or a new
 * group) and, if a minimum payment is given, a monthly goal of that amount on the category.
 */
export function addDebtAccount(state: BudgetState, input: NewDebt, newId: () => string): DebtSetup {
  const name = input.name.trim();
  if (!name) throw new RuleError('An account needs a name.');
  if (!(input.owed >= 0)) throw new RuleError('Enter what is still owed as a positive amount.');
  if (input.minimumPayment !== null && !(input.minimumPayment > 0)) throw new RuleError('Enter an amount greater than zero.');

  // Reuse the group that holds the other debts' payment categories, if it is still in use.
  const existing = state.accounts
    .map((a) => state.categories.find((c) => c.id === a.paymentCategoryId)?.groupId)
    .map((id) => state.groups.find((g) => g.id === id && !g.archived))
    .find((g) => g !== undefined);
  const group: CategoryGroup = existing ?? {
    id: newId(),
    name: input.groupName,
    sortOrder: state.groups.reduce((max, g) => Math.max(max, g.sortOrder + 1), 0),
    archived: false,
  };
  const category: Category = {
    id: newId(),
    groupId: group.id,
    name,
    sortOrder: state.categories.filter((c) => c.groupId === group.id).reduce((max, c) => Math.max(max, c.sortOrder + 1), 0),
    archived: false,
  };
  const goal: Goal | null =
    input.minimumPayment !== null ? { id: newId(), categoryId: category.id, type: 'monthly_amount', monthlyAmount: input.minimumPayment } : null;
  const account: Account = {
    id: newId(),
    name,
    type: 'debt',
    openingBalance: -input.owed,
    sortOrder: state.accounts.reduce((max, a) => Math.max(max, a.sortOrder + 1), 0),
    closed: false,
    paymentCategoryId: category.id,
    ...(input.minimumPayment !== null && { minimumPayment: input.minimumPayment }),
  };
  return {
    state: {
      ...state,
      accounts: [...state.accounts, account],
      groups: existing ? state.groups : [...state.groups, group],
      categories: [...state.categories, category],
      goals: goal ? [...state.goals, goal] : state.goals,
    },
    account,
    group: existing ? null : group,
    category,
    goal,
  };
}

/** Closes or reopens an account. Closing needs a zero balance, so Ready to Assign is not affected. */
export function setAccountClosed(state: BudgetState, accountId: string, closed: boolean): BudgetState {
  if (!state.accounts.some((a) => a.id === accountId)) throw new RuleError('Unknown account.');
  if (closed && accountBalance(state, accountId) !== 0) {
    throw new RuleError('Move the remaining balance to another account before closing this one.');
  }
  return { ...state, accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, closed } : a)) };
}

/** Deletes an account. Refused when it has transactions (including transfers); close it instead. */
export function removeAccount(state: BudgetState, accountId: string): BudgetState {
  if (!state.accounts.some((a) => a.id === accountId)) throw new RuleError('Unknown account.');
  if (hasTransactions(state, accountId)) throw new RuleError('An account with transactions cannot be deleted. Close it instead.');
  return { ...state, accounts: state.accounts.filter((a) => a.id !== accountId) };
}

interface Ordered {
  id: string;
  sortOrder: number;
}

/**
 * Moves one item up (-1) or down (+1) among its siblings, skipping hidden ones (archived or closed), and renumbers
 * the siblings 0..n-1. Returns the list sorted by sortOrder; unchanged if the item is already at that end.
 */
function moveAmong<T extends Ordered>(items: T[], id: string, delta: -1 | 1, isSibling: (t: T) => boolean, isShown: (t: T) => boolean): T[] {
  const siblings = items.filter(isSibling).sort((a, b) => a.sortOrder - b.sortOrder);
  const from = siblings.findIndex((t) => t.id === id);
  if (from < 0) throw new RuleError('Unknown item.');
  let to = from + delta;
  while (siblings[to] && !isShown(siblings[to] as T)) to += delta;
  if (to < 0 || to >= siblings.length) return items;
  const order = [...siblings];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved as T);
  const rank = new Map(order.map((t, i) => [t.id, i]));
  return items
    .map((t) => (rank.has(t.id) ? { ...t, sortOrder: rank.get(t.id) as number } : t))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const moveAccount = (state: BudgetState, id: string, delta: -1 | 1): BudgetState => ({
  ...state,
  accounts: moveAmong(state.accounts, id, delta, () => true, (a) => !a.closed),
});

export const moveGroup = (state: BudgetState, id: string, delta: -1 | 1): BudgetState => ({
  ...state,
  groups: moveAmong(state.groups, id, delta, () => true, (g) => !g.archived),
});

/** Moves a category up or down within its group. */
export function moveCategory(state: BudgetState, id: string, delta: -1 | 1): BudgetState {
  const category = state.categories.find((c) => c.id === id);
  if (!category) throw new RuleError('Unknown category.');
  return {
    ...state,
    categories: moveAmong(state.categories, id, delta, (c) => c.groupId === category.groupId, (c) => !c.archived),
  };
}

/** Puts one item directly before or after another among the same siblings and renumbers them 0..n-1. */
function placeAmong<T extends Ordered>(items: T[], id: string, targetId: string, place: 'before' | 'after', isSibling: (t: T) => boolean): T[] {
  if (id === targetId) return items;
  const order = items.filter(isSibling).sort((a, b) => a.sortOrder - b.sortOrder);
  const moved = order.find((t) => t.id === id);
  if (!moved || !order.some((t) => t.id === targetId)) throw new RuleError('Unknown item.');
  const rest = order.filter((t) => t.id !== id);
  rest.splice(rest.findIndex((t) => t.id === targetId) + (place === 'after' ? 1 : 0), 0, moved);
  const rank = new Map(rest.map((t, i) => [t.id, i]));
  return items
    .map((t) => (rank.has(t.id) ? { ...t, sortOrder: rank.get(t.id) as number } : t))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const moveAccountTo = (state: BudgetState, id: string, targetId: string, place: 'before' | 'after'): BudgetState => ({
  ...state,
  accounts: placeAmong(state.accounts, id, targetId, place, () => true),
});

export const moveGroupTo = (state: BudgetState, id: string, targetId: string, place: 'before' | 'after'): BudgetState => ({
  ...state,
  groups: placeAmong(state.groups, id, targetId, place, () => true),
});

/** Moves a category before or after another category of the same group. */
export function moveCategoryTo(state: BudgetState, id: string, targetId: string, place: 'before' | 'after'): BudgetState {
  const category = state.categories.find((c) => c.id === id);
  const target = state.categories.find((c) => c.id === targetId);
  if (!category || !target || category.groupId !== target.groupId) throw new RuleError('Categories can only be reordered within their group.');
  return { ...state, categories: placeAmong(state.categories, id, targetId, place, (c) => c.groupId === category.groupId) };
}
