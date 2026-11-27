import { create } from 'zustand';
import { NO_FILTERS, type TxFilters } from '../features/transactions/filterTransactions.ts';
import type { Cents, Month } from '../engine/types.ts';

/** A transaction to start the Transactions form with (another tab asked for it). */
export interface PendingTransaction {
  kind: 'transfer';
  accountId: string;
  transferAccountId: string;
  categoryId: string;
  amount: Cents;
}

export type Tab = 'budget' | 'transactions' | 'analytics' | 'settings';

interface Navigation {
  tab: Tab;
  /** Filters for the Transactions tab to start with, set when another tab links to it. Taken once. */
  pendingFilters: TxFilters | null;
  setTab: (tab: Tab) => void;
  /** Opens the Transactions tab with these filters (the rest left open). */
  showTransactions: (filters: Partial<TxFilters>) => void;
  takePendingFilters: () => TxFilters | null;
  pendingTransaction: PendingTransaction | null;
  /** Opens the Transactions tab with the entry form filled in. */
  newTransaction: (prefill: PendingTransaction) => void;
  takePendingTransaction: () => PendingTransaction | null;
}

export const useNavigation = create<Navigation>((set, get) => ({
  tab: 'budget',
  pendingFilters: null,
  pendingTransaction: null,
  newTransaction: (prefill) => set({ tab: 'transactions', pendingTransaction: prefill }),
  takePendingTransaction: () => {
    const prefill = get().pendingTransaction;
    if (prefill) set({ pendingTransaction: null });
    return prefill;
  },
  setTab: (tab) => set({ tab }),
  showTransactions: (filters) => set({ tab: 'transactions', pendingFilters: { ...NO_FILTERS, ...filters } }),
  takePendingFilters: () => {
    const filters = get().pendingFilters;
    if (filters) set({ pendingFilters: null });
    return filters;
  },
}));

/** First and last day of a run of months, as date filters. */
export function monthsAsDates(from: Month, to: Month): { from: string; to: string } {
  const [y, m] = to.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${from}-01`, to: `${to}-${String(last).padStart(2, '0')}` };
}
