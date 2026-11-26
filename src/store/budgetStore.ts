import { create } from 'zustand';
import { createDb, type BudgetDB } from '../db/db.ts';
import type { BackupFile } from '../db/backup.ts';
import * as repo from '../db/repository.ts';
import type { Currency } from '../engine/money.ts';
import { moveAccount, moveAccountTo, moveCategory, moveCategoryTo, moveGroup, moveGroupTo, removeAccount, removeCategories, removeGroup, setAccountClosed, setCategoryArchived, setGroupArchived, updateAccount } from '../engine/edit.ts';
import { autoAssignPlan, planAssignments } from '../engine/autoassign.ts';
import { addMonths } from '../engine/months.ts';
import type { Account, AccountType, BudgetState, Cents, Goal, Month, Transaction } from '../engine/types.ts';

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
  /** ISO timestamp of the last backup export, or null. */
  lastBackupAt: string | null;
  load: () => Promise<void>;
  completeSetup: (input: { accountName: string; initialBalance: Cents; currency: Currency }) => Promise<void>;
  addAccount: (name: string, type: AccountType, openingBalance: Cents) => Promise<void>;
  /** Changes an account's name, type or opening balance. */
  editAccount: (id: string, changes: { name?: string; type?: AccountType; openingBalance?: Cents }) => Promise<void>;
  /** Closes an account (its balance must be zero) or reopens it. */
  setAccountClosed: (id: string, closed: boolean) => Promise<void>;
  /** Deletes an account without transactions. */
  deleteAccount: (id: string) => Promise<void>;
  /** Moves an account, group or category one step up (-1) or down (+1) among its visible siblings. */
  moveAccount: (id: string, delta: -1 | 1) => Promise<void>;
  moveGroup: (id: string, delta: -1 | 1) => Promise<void>;
  moveCategory: (id: string, delta: -1 | 1) => Promise<void>;
  /** Drag and drop: puts an item before or after another one among the same siblings. */
  moveAccountTo: (id: string, targetId: string, place: 'before' | 'after') => Promise<void>;
  moveGroupTo: (id: string, targetId: string, place: 'before' | 'after') => Promise<void>;
  moveCategoryTo: (id: string, targetId: string, place: 'before' | 'after') => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  addCategory: (groupId: string, name: string) => Promise<void>;
  /** Sets this month's Assigned amount for a category. */
  assign: (categoryId: string, assigned: Cents) => Promise<void>;
  /** Adds to each category what its goal still needs this month. Returns how many categories were funded. */
  autoAssign: () => Promise<number>;
  /** Adds a transaction, or replaces the one with the same id. */
  saveTransaction: (t: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  /** Sets the category's goal, replacing any existing one (one goal per category). */
  saveGoal: (goal: Goal) => Promise<void>;
  removeGoal: (categoryId: string) => Promise<void>;
  renameGroup: (id: string, name: string) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  /** Deletes a category and its goal and assignments. Refused if it has transactions (archive it instead). */
  deleteCategory: (id: string) => Promise<void>;
  /** Deletes a group and its categories. Refused if any of them has transactions. */
  deleteGroup: (id: string) => Promise<void>;
  /** Hides a category; its remaining balance returns to Ready to Assign and its history stays. */
  archiveCategory: (id: string) => Promise<void>;
  archiveGroup: (id: string) => Promise<void>;
  /** Brings an archived category back (and its group, if that was archived too). */
  restoreCategory: (id: string) => Promise<void>;
  restoreGroup: (id: string) => Promise<void>;
  /** Switches the display currency. Amounts are not converted. */
  setCurrency: (currency: Currency) => Promise<void>;
  /** Deletes every account, category and transaction; the app returns to the setup screen. */
  clearAllData: () => Promise<void>;
  /** Replaces all data with a validated backup. */
  importBackup: (backup: BackupFile) => Promise<void>;
  /** Records that a backup was just exported. */
  markBackedUp: () => Promise<void>;
  shiftMonth: (n: number) => void;
}

const newAccount = (name: string, type: AccountType, openingBalance: Cents, sortOrder: number): Account => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  type,
  openingBalance,
  sortOrder,
  closed: false,
});

export function createBudgetStore(db: BudgetDB, startMonth: Month = currentMonth()) {
  return create<BudgetStore>()((set, get) => {
    /** Persists the groups and categories whose archived flag changed, then updates the state. */
    const applyArchive = async (next: BudgetState) => {
      const prev = get().state;
      const changedGroups = next.groups.filter((g) => g.archived !== prev.groups.find((p) => p.id === g.id)?.archived);
      const changedCategories = next.categories.filter((c) => c.archived !== prev.categories.find((p) => p.id === c.id)?.archived);
      await repo.saveArchiveChanges(db, changedGroups, changedCategories);
      set({ state: next });
    };

    /** Persists the accounts, groups and categories whose sort order changed, then updates the state. */
    const applyOrder = async (next: BudgetState) => {
      const prev = get().state;
      const changed = <T extends { id: string; sortOrder: number }>(now: T[], before: T[]) =>
        now.filter((t) => t.sortOrder !== before.find((p) => p.id === t.id)?.sortOrder);
      await repo.saveOrder(db, changed(next.accounts, prev.accounts), changed(next.groups, prev.groups), changed(next.categories, prev.categories));
      set({ state: next });
    };

    return {
    ready: false,
    state: emptyState(),
    currency: 'EUR',
    month: startMonth,
    lastBackupAt: null,

    load: async () => {
      const { state, settings } = await repo.loadAll(db);
      set({ state, currency: settings.currency, lastBackupAt: settings.lastBackupAt, ready: true });
    },

    completeSetup: async ({ accountName, initialBalance, currency }) => {
      const account = newAccount(accountName, 'checking', initialBalance, 0);
      await repo.saveSettings(db, { currency, lastBackupAt: get().lastBackupAt });
      await repo.saveAccount(db, account);
      set((s) => ({ currency, state: { ...s.state, accounts: [...s.state.accounts, account] } }));
    },

    addAccount: async (name, type, openingBalance) => {
      if (!name.trim()) return;
      const account = newAccount(name, type, openingBalance, get().state.accounts.reduce((max, a) => Math.max(max, a.sortOrder + 1), 0));
      await repo.saveAccount(db, account);
      set((s) => ({ state: { ...s.state, accounts: [...s.state.accounts, account] } }));
    },

    editAccount: async (id, changes) => {
      const next = updateAccount(get().state, id, changes);
      await repo.saveAccount(db, next.accounts.find((a) => a.id === id)!);
      set({ state: next });
    },

    setAccountClosed: async (id, closed) => {
      const next = setAccountClosed(get().state, id, closed);
      await repo.saveAccount(db, next.accounts.find((a) => a.id === id)!);
      set({ state: next });
    },

    deleteAccount: async (id) => {
      const next = removeAccount(get().state, id);
      await repo.deleteAccount(db, id);
      set({ state: next });
    },

    moveAccount: (id, delta) => applyOrder(moveAccount(get().state, id, delta)),
    moveGroup: (id, delta) => applyOrder(moveGroup(get().state, id, delta)),
    moveCategory: (id, delta) => applyOrder(moveCategory(get().state, id, delta)),

    moveAccountTo: (id, targetId, place) => applyOrder(moveAccountTo(get().state, id, targetId, place)),
    moveGroupTo: (id, targetId, place) => applyOrder(moveGroupTo(get().state, id, targetId, place)),
    moveCategoryTo: (id, targetId, place) => applyOrder(moveCategoryTo(get().state, id, targetId, place)),

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

    autoAssign: async () => {
      const { state, month } = get();
      const assignments = planAssignments(state, autoAssignPlan(state, month), month);
      for (const a of assignments) await get().assign(a.categoryId, a.assigned);
      return assignments.length;
    },

    saveTransaction: async (t) => {
      await repo.saveTransaction(db, t);
      set((s) => ({
        state: { ...s.state, transactions: [...s.state.transactions.filter((x) => x.id !== t.id), t] },
      }));
    },

    removeTransaction: async (id) => {
      await repo.deleteTransaction(db, id);
      set((s) => ({ state: { ...s.state, transactions: s.state.transactions.filter((x) => x.id !== id) } }));
    },

    saveGoal: async (goal) => {
      const replaced = get().state.goals.filter((g) => g.categoryId === goal.categoryId && g.id !== goal.id);
      for (const g of replaced) await repo.deleteGoal(db, g.id);
      await repo.saveGoal(db, goal);
      set((s) => ({
        state: { ...s.state, goals: [...s.state.goals.filter((g) => g.categoryId !== goal.categoryId), goal] },
      }));
    },

    removeGoal: async (categoryId) => {
      for (const g of get().state.goals.filter((g) => g.categoryId === categoryId)) await repo.deleteGoal(db, g.id);
      set((s) => ({ state: { ...s.state, goals: s.state.goals.filter((g) => g.categoryId !== categoryId) } }));
    },

    renameGroup: async (id, name) => {
      const group = get().state.groups.find((g) => g.id === id);
      if (!group || !name.trim()) return;
      const updated = { ...group, name: name.trim() };
      await repo.saveGroup(db, updated);
      set((s) => ({ state: { ...s.state, groups: s.state.groups.map((g) => (g.id === id ? updated : g)) } }));
    },

    renameCategory: async (id, name) => {
      const category = get().state.categories.find((c) => c.id === id);
      if (!category || !name.trim()) return;
      const updated = { ...category, name: name.trim() };
      await repo.saveCategory(db, updated);
      set((s) => ({ state: { ...s.state, categories: s.state.categories.map((c) => (c.id === id ? updated : c)) } }));
    },

    deleteCategory: async (id) => {
      const next = removeCategories(get().state, [id]); // throws before touching the database if invalid
      await repo.deleteCategory(db, id);
      set({ state: next });
    },

    deleteGroup: async (id) => {
      const next = removeGroup(get().state, id);
      await repo.deleteGroup(db, id);
      set({ state: next });
    },

    archiveCategory: (id) => applyArchive(setCategoryArchived(get().state, id, true)),
    archiveGroup: (id) => applyArchive(setGroupArchived(get().state, id, true)),
    restoreCategory: (id) => applyArchive(setCategoryArchived(get().state, id, false)),
    restoreGroup: (id) => applyArchive(setGroupArchived(get().state, id, false)),

    setCurrency: async (currency) => {
      await repo.saveSettings(db, { currency, lastBackupAt: get().lastBackupAt });
      set({ currency });
    },

    clearAllData: async () => {
      const settings = { currency: get().currency, lastBackupAt: null };
      await repo.replaceAll(db, emptyState(), settings);
      set({ state: emptyState(), lastBackupAt: null });
    },

    importBackup: async (backup) => {
      const settings = { currency: backup.settings.currency, lastBackupAt: get().lastBackupAt };
      await repo.replaceAll(db, backup.data, settings);
      set({ state: backup.data, currency: settings.currency });
    },

    markBackedUp: async () => {
      const lastBackupAt = new Date().toISOString();
      await repo.saveSettings(db, { currency: get().currency, lastBackupAt });
      set({ lastBackupAt });
    },

    shiftMonth: (n) => set((s) => ({ month: addMonths(s.month, n) })),
    };
  });
}

/** The app's store, backed by the browser's IndexedDB. */
export const useBudgetStore = createBudgetStore(createDb());
