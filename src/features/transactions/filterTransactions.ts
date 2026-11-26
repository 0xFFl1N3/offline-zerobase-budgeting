import type { BudgetState, Transaction } from '../../engine/types.ts';

/**
 * Category filter values: 'all', 'cat:<id>', 'group:<id>' (every category of a group), 'income'
 * (inflows without a category), 'transfers', or 'uncategorised' (old outflows that lack a category).
 */
export interface TxFilters {
  /** An account id or 'all'. Transfers match on either side. */
  accountId: string;
  category: string;
  /** 'YYYY-MM-DD' or '' for no limit; both ends are inclusive. */
  from: string;
  to: string;
  /** Matches payee, memo and category name, ignoring case. */
  search: string;
}

export const NO_FILTERS: TxFilters = { accountId: 'all', category: 'all', from: '', to: '', search: '' };

export const hasActiveFilters = (f: TxFilters): boolean =>
  f.accountId !== 'all' || f.category !== 'all' || f.from !== '' || f.to !== '' || f.search.trim() !== '';

function matchesCategory(state: BudgetState, t: Transaction, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'transfers') return t.transferAccountId !== null;
  if (t.transferAccountId !== null) return false;
  if (filter === 'income') return t.categoryId === null && t.amount > 0;
  if (filter === 'uncategorised') return t.categoryId === null && t.amount <= 0;
  if (filter.startsWith('cat:')) return t.categoryId === filter.slice(4);
  if (filter.startsWith('group:')) {
    const category = state.categories.find((c) => c.id === t.categoryId);
    return category !== undefined && category.groupId === filter.slice(6);
  }
  return true;
}

/** The transactions that pass all filters, newest first (same day: last entered first). */
export function filterTransactions(state: BudgetState, f: TxFilters): Transaction[] {
  const q = f.search.trim().toLowerCase();
  const categoryName = (t: Transaction) => state.categories.find((c) => c.id === t.categoryId)?.name ?? '';
  return state.transactions
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => f.accountId === 'all' || t.accountId === f.accountId || t.transferAccountId === f.accountId)
    .filter(({ t }) => matchesCategory(state, t, f.category))
    .filter(({ t }) => (f.from === '' || t.date >= f.from) && (f.to === '' || t.date <= f.to))
    .filter(({ t }) => !q || [t.payee, t.memo, categoryName(t)].some((text) => text.toLowerCase().includes(q)))
    // Newest first; on the same day the one entered last comes first, matching runningBalances.
    .sort((a, b) => (a.t.date === b.t.date ? b.index - a.index : a.t.date < b.t.date ? 1 : -1))
    .map(({ t }) => t);
}
