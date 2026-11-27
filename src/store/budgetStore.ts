import { create } from 'zustand';
import { createDb, type BudgetDB } from '../db/db.ts';
import { createBackup, parseBackup, serializeBackup, type BackupFile } from '../db/backup.ts';
import { buildDemo, type DemoLanguage } from '../engine/demo.ts';
import * as repo from '../db/repository.ts';
import type { Currency } from '../engine/money.ts';
import { addDebtAccount, type NewDebt } from '../engine/edit.ts';
import { prepareTransaction } from '../engine/debt.ts';
import { moveAccount, moveAccountTo, moveCategory, moveCategoryTo, moveGroup, moveGroupTo, removeAccount, removeCategories, removeGroup, setAccountClosed, setCategoryArchived, setGroupArchived, updateAccount } from '../engine/edit.ts';
import { assignPlan, planAssignments, type AssignKind } from '../engine/autoassign.ts';
import { addMonths } from '../engine/months.ts';
import { activeSeriesUsing, bookNext, pauseSeries, recurringFrom, setRecurringPaused, skipNext, startRecurring, updateRecurring, type RecurringChanges } from '../engine/recurring.ts';
import { toISODate } from '../engine/months.ts';
import { reconcile, withCleared } from '../engine/reconcile.ts';
import type { Account, AccountType, BudgetState, Cents, ClearedStatus, Frequency, Goal, GoalDraft, Month, Transaction } from '../engine/types.ts';
import { RuleError } from '../engine/ruleError.ts';
import { classify, markReported, type Problem } from '../i18n/errors.ts';
import { connectTabs } from './tabSync.ts';

const emptyState = (): BudgetState => ({
  accounts: [],
  groups: [],
  categories: [],
  goals: [],
  monthlyBudgets: [],
  transactions: [],
  recurring: [],
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
  /** The budget is the sample data from the setup screen. */
  demo: boolean;
  /** The latest delete, until it is undone, dismissed or another change is made. */
  undo: UndoEntry | null;
  /** A failed save or load, shown in the error bar until dismissed. */
  problem: Problem | null;
  reportProblem: (problem: Problem) => void;
  dismissProblem: () => void;
  /** Restores the data from just before the latest delete. */
  undoDelete: () => Promise<void>;
  dismissUndo: () => void;
  load: () => Promise<void>;
  /** The budget as saved in the database (not this tab's copy), e.g. for backups. */
  readSaved: () => Promise<{ state: BudgetState; currency: Currency; demo: boolean }>;
  /** Fills the empty app with a year of sample data, through the same checks as restoring a backup. */
  startDemo: (language: DemoLanguage) => Promise<void>;
  completeSetup: (input: { accountName: string; initialBalance: Cents; currency: Currency }) => Promise<void>;
  addAccount: (name: string, type: AccountType, openingBalance: Cents) => Promise<void>;
  /** Adds a debt with its payment category (and a monthly goal for the minimum payment). */
  addDebt: (input: NewDebt) => Promise<void>;
  /** Changes an account's name, type or opening balance. */
  editAccount: (id: string, changes: { name?: string; type?: AccountType; openingBalance?: Cents; minimumPayment?: Cents | null }) => Promise<void>;
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
  /** With `goal`, the category is created together with that goal. */
  addCategory: (groupId: string, name: string, goal?: GoalDraft) => Promise<void>;
  /** Sets this month's Assigned amount for a category. */
  assign: (categoryId: string, assigned: Cents) => Promise<void>;
  /** Adds to each category what its goal still needs this month. Returns how many categories were funded. */
  /** Fills categories the chosen way (goals by default); returns how many categories changed. */
  /** `only`: just these categories (the ones ticked in the budget). */
  autoAssign: (kind?: AssignKind, only?: ReadonlySet<string>) => Promise<number>;
  /**
   * Starts a recurring series from a transaction just entered: it is booked now if its date has come,
   * otherwise it becomes the first due occurrence.
   */
  startRecurringSeries: (t: Transaction, frequency: Frequency, endDate: string | null) => Promise<void>;
  /** Makes an existing transaction the first occurrence of a new series. */
  makeRecurring: (transactionId: string, frequency: Frequency, endDate: string | null) => Promise<void>;
  /** Books the next occurrence of a series as a transaction; `amount` (positive) overrides the usual amount. */
  confirmRecurring: (id: string, amount?: Cents) => Promise<void>;
  skipRecurring: (id: string) => Promise<void>;
  editRecurring: (id: string, changes: RecurringChanges) => Promise<void>;
  pauseRecurring: (id: string, paused: boolean) => Promise<void>;
  /** Deletes the series; transactions already booked from it stay. */
  deleteRecurring: (id: string) => Promise<void>;
  /** Adds a transaction, or replaces the one with the same id. */
  saveTransaction: (t: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  /** Adds or replaces many transactions at once (a bank import, including updated pending ones). */
  importTransactions: (transactions: Transaction[]) => Promise<void>;
  /** Sets the cleared status of one account's side of a transaction. */
  setCleared: (transactionId: string, accountId: string, status: ClearedStatus) => Promise<void>;
  /** Finishes reconciling an account against a statement balance; adds an adjustment if they differ. */
  reconcileAccount: (accountId: string, statementBalance: Cents, adjustmentCategoryId: string | null) => Promise<void>;
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

/** What was deleted, for the Undo bar's text. */
export type UndoKind = 'transaction' | 'account' | 'category' | 'group' | 'recurring' | 'goal';
export interface UndoEntry {
  kind: UndoKind;
  /** The whole budget as it was just before the delete. */
  before: BudgetState;
  /** When the delete happened (ms), so a new delete restarts the bar. */
  at: number;
}

const newAccount = (name: string, type: AccountType, openingBalance: Cents, sortOrder: number): Account => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  type,
  openingBalance,
  sortOrder,
  closed: false,
});

/**
 * The one try/catch for saving: wraps every action so a storage or unexpected error is put in `problem`
 * (shown by the error bar) and marked as reported. The error is thrown on, so a caller can still tell that
 * it failed; rule errors are left to the caller to show (see useAction). A later action that works clears a
 * storage problem.
 */
function guardActions<T extends object>(actions: T, report: (problem: Problem) => void, saved: () => void): T {
  const handle = (error: unknown) => {
    const problem = classify(error);
    if (problem.kind !== 'rule') {
      report(problem);
      markReported(error);
    }
    return error;
  };
  const guarded: Record<string, unknown> = { ...(actions as Record<string, unknown>) };
  for (const [key, value] of Object.entries(actions)) {
    if (typeof value !== 'function' || key === 'reportProblem' || key === 'dismissProblem') continue;
    guarded[key] = (...args: unknown[]) => {
      try {
        const result = (value as (...a: unknown[]) => unknown)(...args);
        // A save that works again means a storage problem shown earlier is over.
        return result instanceof Promise ? result.then((v) => (saved(), v), (e: unknown) => Promise.reject(handle(e))) : result;
      } catch (e) {
        throw handle(e);
      }
    };
  }
  return guarded as T;
}

export function createBudgetStore(db: BudgetDB, startMonth: Month = currentMonth()) {
  const store = create<BudgetStore>()((set, get) => {
    /** Runs a delete and keeps the data from before it for Undo. */
    /** The settings as they are now, with some changed; every save goes through this so none is lost on the way. */
    const settingsNow = (changes: Partial<repo.Settings> = {}): repo.Settings => ({
      currency: get().currency,
      lastBackupAt: get().lastBackupAt,
      demo: get().demo,
      ...changes,
    });
    const undoable = async (kind: UndoKind, run: () => Promise<BudgetState>) => {
      const before = get().state;
      const next = await run();
      set({ state: next, undo: { kind, before, at: Date.now() } });
    };

    /** Persists the groups and categories whose archived flag changed, then updates the state. */
    const applyArchive = async (archivedState: BudgetState) => {
      const prev = get().state;
      const changedGroups = archivedState.groups.filter((g) => g.archived !== prev.groups.find((p) => p.id === g.id)?.archived);
      const changedCategories = archivedState.categories.filter((c) => c.archived !== prev.categories.find((p) => p.id === c.id)?.archived);
      // Series that book into a category being archived are paused, or they would keep spending out of sight.
      const nowArchived = changedCategories.filter((c) => c.archived).map((c) => c.id);
      const groupArchived = new Set(changedGroups.filter((g) => g.archived).map((g) => g.id));
      for (const c of archivedState.categories) if (groupArchived.has(c.groupId)) nowArchived.push(c.id);
      const series = activeSeriesUsing(prev, { categoryIds: nowArchived });
      const next = pauseSeries(archivedState, series.map((r) => r.id));
      await repo.saveArchiveChanges(db, changedGroups, changedCategories, next.recurring.filter((r) => series.some((s) => s.id === r.id)));
      set({ state: next });
    };

    /**
     * Every transaction the store saves goes through here (see prepareTransaction): a debt payment is
     * recognised and the debt rules are checked before anything is written.
     */
    const prepared = <T extends Transaction>(t: T): T => prepareTransaction(get().state, t);

    /** Persists the accounts, groups and categories whose sort order changed, then updates the state. */
    const applyOrder = async (next: BudgetState) => {
      const prev = get().state;
      const changed = <T extends { id: string; sortOrder: number }>(now: T[], before: T[]) =>
        now.filter((t) => t.sortOrder !== before.find((p) => p.id === t.id)?.sortOrder);
      await repo.saveOrder(db, changed(next.accounts, prev.accounts), changed(next.groups, prev.groups), changed(next.categories, prev.categories));
      set({ state: next });
    };

    return guardActions({
    ready: false,
    state: emptyState(),
    currency: 'EUR',
    month: startMonth,
    lastBackupAt: null,
    demo: false,
    undo: null,
    problem: null,
    reportProblem: (problem) => set({ problem }),
    dismissProblem: () => set({ problem: null }),

    undoDelete: async () => {
      const entry = get().undo;
      if (!entry) return;
      await repo.replaceAll(db, entry.before, settingsNow());
      set({ state: entry.before, undo: null });
    },
    dismissUndo: () => set({ undo: null }),

    readSaved: async () => {
      const { state, settings } = await repo.loadAll(db);
      return { state, currency: settings.currency, demo: settings.demo };
    },

    load: async () => {
      const { state, settings } = await repo.loadAll(db);
      set({ state, currency: settings.currency, lastBackupAt: settings.lastBackupAt, demo: settings.demo, ready: true });
    },

    completeSetup: async ({ accountName, initialBalance, currency }) => {
      const account = newAccount(accountName, 'checking', initialBalance, 0);
      await repo.saveSettings(db, settingsNow({ currency, demo: false }));
      await repo.saveAccount(db, account);
      set((s) => ({ currency, demo: false, state: { ...s.state, accounts: [...s.state.accounts, account] } }));
    },

    addAccount: async (name, type, openingBalance) => {
      if (!name.trim()) return;
      const account = newAccount(name, type, openingBalance, get().state.accounts.reduce((max, a) => Math.max(max, a.sortOrder + 1), 0));
      await repo.saveAccount(db, account);
      set((s) => ({ state: { ...s.state, accounts: [...s.state.accounts, account] } }));
    },

    addDebt: async (input) => {
      const setup = addDebtAccount(get().state, input, () => crypto.randomUUID());
      await repo.saveDebtSetup(db, setup);
      set({ state: setup.state });
    },

    editAccount: async (id, changes) => {
      const next = updateAccount(get().state, id, changes);
      await repo.saveAccount(db, next.accounts.find((a) => a.id === id)!);
      set({ state: next });
    },

    setAccountClosed: async (id, closed) => {
      let next = setAccountClosed(get().state, id, closed);
      // Closing pauses the series that book into the account (reopening leaves them paused; resume them yourself).
      const series = closed ? activeSeriesUsing(next, { accountIds: [id] }) : [];
      next = pauseSeries(next, series.map((r) => r.id));
      await repo.saveAccountAndSeries(db, next.accounts.find((a) => a.id === id)!, next.recurring.filter((r) => series.some((s) => s.id === r.id)));
      set({ state: next });
    },

    deleteAccount: (id) =>
      undoable('account', async () => {
        const next = removeAccount(get().state, id);
        await repo.deleteAccount(db, id);
        return next;
      }),

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

    addCategory: async (groupId, name, draft) => {
      if (!name.trim()) return;
      const sortOrder = get()
        .state.categories.filter((c) => c.groupId === groupId)
        .reduce((max, c) => Math.max(max, c.sortOrder + 1), 0);
      const category = { id: crypto.randomUUID(), groupId, name: name.trim(), sortOrder, archived: false };
      const goal: Goal | null = draft ? { ...draft, id: crypto.randomUUID(), categoryId: category.id } : null;
      if (goal) await repo.addCategoryWithGoal(db, category, goal);
      else await repo.saveCategory(db, category);
      set((s) => ({
        state: { ...s.state, categories: [...s.state.categories, category], goals: goal ? [...s.state.goals, goal] : s.state.goals },
      }));
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

    autoAssign: async (kind = 'goals', only) => {
      const { state, month } = get();
      const assignments = planAssignments(state, assignPlan(state, month, kind, undefined, only), month);
      if (assignments.length === 0) return 0;
      await repo.setAssignedMany(db, month, assignments);
      const changed = new Set(assignments.map((a) => a.categoryId));
      set((s) => {
        const others = s.state.monthlyBudgets.filter((b) => !(b.month === month && changed.has(b.categoryId)));
        const added = assignments.filter((a) => a.assigned !== 0).map((a) => ({ categoryId: a.categoryId, month, assigned: a.assigned }));
        return { state: { ...s.state, monthlyBudgets: [...others, ...added] } };
      });
      return assignments.length;
    },

    startRecurringSeries: async (input, frequency, endDate) => {
      const t = prepared(input);
      const { transaction, recurring } = startRecurring(t, frequency, endDate, toISODate(), crypto.randomUUID());
      await repo.saveRecurringBooking(db, recurring, transaction);
      set((s) => ({
        state: { ...s.state, recurring: [...s.state.recurring, recurring], transactions: transaction ? [...s.state.transactions, transaction] : s.state.transactions },
      }));
    },

    makeRecurring: async (transactionId, frequency, endDate) => {
      const t = get().state.transactions.find((x) => x.id === transactionId);
      if (!t) throw new RuleError('Unknown transaction.');
      const recurring = recurringFrom(prepared(t), frequency, endDate, crypto.randomUUID());
      await repo.saveRecurring(db, recurring);
      set((s) => ({ state: { ...s.state, recurring: [...s.state.recurring, recurring] } }));
    },

    confirmRecurring: async (id, amount) => {
      const rec = get().state.recurring.find((r) => r.id === id);
      if (!rec) throw new RuleError('Unknown recurring transaction.');
      const booked = bookNext(rec, crypto.randomUUID(), amount);
      const transaction = prepared(booked.transaction);
      const recurring = booked.recurring;
      await repo.saveRecurringBooking(db, recurring, transaction);
      set((s) => ({
        state: { ...s.state, recurring: s.state.recurring.map((r) => (r.id === id ? recurring : r)), transactions: [...s.state.transactions, transaction] },
      }));
    },

    skipRecurring: async (id) => {
      const rec = get().state.recurring.find((r) => r.id === id);
      if (!rec) throw new RuleError('Unknown recurring transaction.');
      const next = skipNext(rec);
      await repo.saveRecurring(db, next);
      set((s) => ({ state: { ...s.state, recurring: s.state.recurring.map((r) => (r.id === id ? next : r)) } }));
    },

    editRecurring: async (id, changes) => {
      const rec = get().state.recurring.find((r) => r.id === id);
      if (!rec) throw new RuleError('Unknown recurring transaction.');
      const next = updateRecurring(rec, changes);
      await repo.saveRecurring(db, next);
      set((s) => ({ state: { ...s.state, recurring: s.state.recurring.map((r) => (r.id === id ? next : r)) } }));
    },

    pauseRecurring: async (id, paused) => {
      const rec = get().state.recurring.find((r) => r.id === id);
      if (!rec) throw new RuleError('Unknown recurring transaction.');
      const next = setRecurringPaused(rec, paused, toISODate());
      await repo.saveRecurring(db, next);
      set((s) => ({ state: { ...s.state, recurring: s.state.recurring.map((r) => (r.id === id ? next : r)) } }));
    },

    deleteRecurring: (id) =>
      undoable('recurring', async () => {
        await repo.deleteRecurring(db, id);
        const s = get().state;
        return { ...s, recurring: s.recurring.filter((r) => r.id !== id) };
      }),

    saveTransaction: async (input) => {
      const t = prepared(input);
      await repo.saveTransaction(db, t);
      set((s) => ({
        state: { ...s.state, transactions: [...s.state.transactions.filter((x) => x.id !== t.id), t] },
      }));
    },

    importTransactions: async (input) => {
      const transactions = input.map(prepared);
      await repo.saveTransactions(db, transactions);
      const ids = new Set(transactions.map((t) => t.id));
      set((s) => ({ state: { ...s.state, transactions: [...s.state.transactions.filter((t) => !ids.has(t.id)), ...transactions] } }));
    },

    setCleared: async (transactionId, accountId, status) => {
      const t = get().state.transactions.find((x) => x.id === transactionId);
      if (!t) return;
      const next = prepared(withCleared(t, accountId, status));
      await repo.saveTransaction(db, next);
      set((s) => ({ state: { ...s.state, transactions: s.state.transactions.map((x) => (x.id === next.id ? next : x)) } }));
    },

    reconcileAccount: async (accountId, statementBalance, adjustmentCategoryId) => {
      const result = reconcile(get().state, accountId, statementBalance, {
        today: toISODate(),
        adjustmentId: crypto.randomUUID(),
        categoryId: adjustmentCategoryId,
      });
      // What is saved and what is shown must be the same, so the prepared versions replace the originals.
      const changed = new Map(result.changed.map(prepared).map((t) => [t.id, t]));
      await repo.saveReconciliation(db, result.account, [...changed.values()]);
      set({ state: { ...result.state, transactions: result.state.transactions.map((t) => changed.get(t.id) ?? t) } });
    },

    removeTransaction: (id) =>
      undoable('transaction', async () => {
        await repo.deleteTransaction(db, id);
        const s = get().state;
        return { ...s, transactions: s.transactions.filter((x) => x.id !== id) };
      }),

    saveGoal: async (goal) => {
      const replaced = get().state.goals.filter((g) => g.categoryId === goal.categoryId && g.id !== goal.id);
      await repo.replaceGoal(db, goal, replaced.map((g) => g.id));
      set((s) => ({
        state: { ...s.state, goals: [...s.state.goals.filter((g) => g.categoryId !== goal.categoryId), goal] },
      }));
    },

    removeGoal: (categoryId) =>
      undoable('goal', async () => {
        await repo.deleteGoals(db, get().state.goals.filter((g) => g.categoryId === categoryId).map((g) => g.id));
        const s = get().state;
        return { ...s, goals: s.goals.filter((g) => g.categoryId !== categoryId) };
      }),

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

    deleteCategory: (id) =>
      undoable('category', async () => {
        const next = removeCategories(get().state, [id]); // throws before touching the database if invalid
        await repo.deleteCategory(db, id);
        return next;
      }),

    deleteGroup: (id) =>
      undoable('group', async () => {
        const next = removeGroup(get().state, id);
        await repo.deleteGroup(db, id);
        return next;
      }),

    archiveCategory: (id) => applyArchive(setCategoryArchived(get().state, id, true)),
    archiveGroup: (id) => applyArchive(setGroupArchived(get().state, id, true)),
    restoreCategory: (id) => applyArchive(setCategoryArchived(get().state, id, false)),
    restoreGroup: (id) => applyArchive(setGroupArchived(get().state, id, false)),

    setCurrency: async (currency) => {
      await repo.saveSettings(db, settingsNow({ currency }));
      set({ currency });
    },

    clearAllData: async () => {
      await repo.replaceAll(db, emptyState(), settingsNow({ lastBackupAt: null, demo: false }));
      set({ state: emptyState(), lastBackupAt: null, demo: false });
    },

    importBackup: async (backup) => {
      const settings = settingsNow({ currency: backup.settings.currency, demo: backup.settings.demo === true });
      await repo.replaceAll(db, backup.data, settings);
      set({ state: backup.data, currency: settings.currency, demo: settings.demo });
    },

    startDemo: async (language) => {
      const parsed = parseBackup(serializeBackup(createBackup(buildDemo(toISODate(), language), 'EUR', new Date(), true)));
      if (!parsed.ok) throw new Error(parsed.error);
      await get().importBackup(parsed.backup);
    },

    markBackedUp: async () => {
      const lastBackupAt = new Date().toISOString();
      await repo.saveSettings(db, settingsNow({ lastBackupAt }));
      set({ lastBackupAt });
    },

    shiftMonth: (n) => set((s) => ({ month: addMonths(s.month, n) })),
    }, (problem) => set({ problem }), () => {
      if (get().problem?.kind === 'storage') set({ problem: null });
    });
  });
  // Undo only covers the latest delete: any other change to the budget ends it, so it never throws away later work.
  store.subscribe((now, prev) => {
    if (now.undo && now.undo === prev.undo && now.state !== prev.state) store.setState({ undo: null });
  });
  return store;
}

const appDb = createDb();
/** The app's store, backed by the browser's IndexedDB. */
export const useBudgetStore = createBudgetStore(appDb);
connectTabs(useBudgetStore);

// A newer version of the app opened in another tab wants to change how the data is stored. Let it (close this
// connection, without reopening), and ask for a reload rather than saving with outdated code.
appDb.on('versionchange', () => {
  appDb.close({ disableAutoOpen: true });
  useBudgetStore.getState().reportProblem({ kind: 'storage', message: 'error.updatedElsewhere', detail: '', reload: true });
  return false;
});
