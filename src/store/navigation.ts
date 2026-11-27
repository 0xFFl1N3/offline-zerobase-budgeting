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

/**
 * The pages between setup and the budget: how to start, the suggested categories. `firstRun`: right after setup
 * (Back on the suggestions returns to the choice); otherwise the suggestions were opened from the budget.
 */
export interface StartStep {
  /** midMonth: the last question after setup, "Are you starting in the middle of the month?". */
  step: 'choose' | 'suggestions' | 'midMonth';
  firstRun: boolean;
}

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
  /** A page shown instead of the app, see StartStep; null for the app itself. Not stored. */
  start: StartStep | null;
  setStart: (start: StartStep | null) => void;
  /** The debt whose payoff plan is open, if any. */
  debtDialog: string | null;
  openDebt: (id: string | null) => void;
}

export const useNavigation = create<Navigation>((set, get) => ({
  tab: 'budget',
  pendingFilters: null,
  pendingTransaction: null,
  debtDialog: null,
  start: null,
  setStart: (start) => set({ start }),
  openDebt: (id) => set({ debtDialog: id }),
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
