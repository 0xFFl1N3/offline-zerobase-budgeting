import { create } from 'zustand';
import { createDb, type BudgetDB } from '../db/db.ts';
import * as repo from '../db/repository.ts';
import type { Currency } from '../engine/money.ts';
import { addMonths } from '../engine/months.ts';
import type { Account, AccountType, BudgetState, Cents, Month } from '../engine/types.ts';

const emptyState = (): BudgetState => ({
  accounts: [],
  groups: [],
  categories: [],
  goals: [],
  monthlyBudgets: [],
  transactions: [],
});

export function currentMonth(now = new Date()): Month {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface BudgetStore {
  ready: boolean;
  state: BudgetState;
  currency: Currency;
  month: Month;
  load: () => Promise<void>;
  completeSetup: (input: { accountName: string; initialBalance: Cents; currency: Currency }) => Promise<void>;
  addAccount: (name: string, type: AccountType, openingBalance: Cents) => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  addCategory: (groupId: string, name: string) => Promise<void>;
  /** Sets this month's Assigned amount for a category. */
  assign: (categoryId: string, assigned: Cents) => Promise<void>;
  shiftMonth: (n: number) => void;
}

const newAccount = (name: string, type: AccountType, openingBalance: Cents): Account => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  type,
  openingBalance,
  closed: false,
});

export function createBudgetStore(db: BudgetDB, startMonth: Month = currentMonth()) {
  return create<BudgetStore>()((set, get) => ({
    ready: false,
    state: emptyState(),
    currency: 'EUR',
    month: startMonth,

    load: async () => {
      const { state, settings } = await repo.loadAll(db);
      set({ state, currency: settings.currency, ready: true });
    },

    completeSetup: async ({ accountName, initialBalance, currency }) => {
      const account = newAccount(accountName, 'checking', initialBalance);
      await repo.saveSettings(db, { currency });
      await repo.saveAccount(db, account);
      set((s) => ({ currency, state: { ...s.state, accounts: [...s.state.accounts, account] } }));
    },

    addAccount: async (name, type, openingBalance) => {
      if (!name.trim()) return;
      const account = newAccount(name, type, openingBalance);
      await repo.saveAccount(db, account);
      set((s) => ({ state: { ...s.state, accounts: [...s.state.accounts, account] } }));
    },

    addGroup: async (name) => {
      if (!name.trim()) return;
      const sortOrder = get().state.groups.reduce((max, g) => Math.max(max, g.sortOrder + 1), 0);
      const group = { id: crypto.randomUUID(), name: name.trim(), sortOrder, archived: false };
      await repo.saveGroup(db, group);
      set((s) => ({ state: { ...s.state, groups: [...s.state.groups, group] } }));
    },

    addCategory: async (groupId, name) => {
      if (!name.trim()) return;
      const sortOrder = get()
        .state.categories.filter((c) => c.groupId === groupId)
        .reduce((max, c) => Math.max(max, c.sortOrder + 1), 0);
      const category = { id: crypto.randomUUID(), groupId, name: name.trim(), sortOrder, archived: false };
      await repo.saveCategory(db, category);
      set((s) => ({ state: { ...s.state, categories: [...s.state.categories, category] } }));
    },

    assign: async (categoryId, assigned) => {
      const month = get().month;
      await repo.setAssigned(db, categoryId, month, assigned);
      set((s) => {
        const others = s.state.monthlyBudgets.filter((b) => !(b.categoryId === categoryId && b.month === month));
        const monthlyBudgets = assigned === 0 ? others : [...others, { categoryId, month, assigned }];
        return { state: { ...s.state, monthlyBudgets } };
      });
    },

    shiftMonth: (n) => set((s) => ({ month: addMonths(s.month, n) })),
  }));
}

/** The app's store, backed by the browser's IndexedDB. */
export const useBudgetStore = createBudgetStore(createDb());
