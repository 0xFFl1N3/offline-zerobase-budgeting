import type { BudgetDB } from './db.ts';
import type { Currency } from '../engine/money.ts';
import type {
  Account,
  BudgetState,
  Category,
  CategoryGroup,
  Cents,
  Goal,
  Month,
  RecurringTransaction,
  Transaction,
} from '../engine/types.ts';

/** Goals saved before the 'save by a month' type was merged into 'save up to' are read as the latter. */
function normalizeGoal(g: Goal): Goal {
  return (g.type as string) === 'target_by_date' ? { ...g, type: 'target_balance' } : g;
}

export interface Settings {
  currency: Currency;
  /** ISO timestamp of the last backup export, or null if never. */
  lastBackupAt: string | null;
}

const DEFAULT_CURRENCY: Currency = 'EUR';

export async function loadAll(db: BudgetDB): Promise<{ state: BudgetState; settings: Settings }> {
  const [accounts, groups, categories, goals, monthlyBudgets, transactions, recurring, settingRows] = await Promise.all([
    db.accounts.toArray(),
    db.groups.toArray(),
    db.categories.toArray(),
    db.goals.toArray(),
    db.monthlyBudgets.toArray(),
    db.transactions.toArray(),
    db.recurring.toArray(),
    db.settings.toArray(),
  ]);
  const byKey = new Map(settingRows.map((r) => [r.key, r.value]));
  const currency = byKey.get('currency') === 'USD' ? 'USD' : DEFAULT_CURRENCY;
  return {
    state: {
      // Accounts saved before ordering existed have no sortOrder: keep the order they came in.
      accounts: accounts
        .map((a, index) => (typeof a.sortOrder === 'number' ? a : { ...a, sortOrder: index }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      groups: groups.sort((a, b) => a.sortOrder - b.sortOrder),
      categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
      goals: goals.map(normalizeGoal),
      monthlyBudgets,
      transactions,
      recurring,
    },
    settings: { currency, lastBackupAt: byKey.get('lastBackupAt') ?? null },
  };
}

export const saveAccount = (db: BudgetDB, a: Account) => db.accounts.put(a);

/** Stores a finished reconciliation: the account's date and every changed or added transaction, together. */
export const saveReconciliation = (db: BudgetDB, account: Account, transactions: Transaction[]) =>
  db.transaction('rw', [db.accounts, db.transactions], async () => {
    await db.accounts.put(account);
    await db.transactions.bulkPut(transactions);
  });
export const deleteAccount = (db: BudgetDB, id: string) => db.accounts.delete(id);
export const saveGroup = (db: BudgetDB, g: CategoryGroup) => db.groups.put(g);
export const saveCategory = (db: BudgetDB, c: Category) => db.categories.put(c);
async function deleteCategoriesIn(db: BudgetDB, ids: string[]) {
  for (const id of ids) {
    await db.categories.delete(id);
    await db.goals.where('categoryId').equals(id).delete();
    await db.monthlyBudgets.filter((b) => b.categoryId === id).delete();
  }
}

/** Deletes a category with its goal and assignments. The caller makes sure it has no transactions. */
export const deleteCategory = (db: BudgetDB, id: string) =>
  db.transaction('rw', [db.categories, db.goals, db.monthlyBudgets], () => deleteCategoriesIn(db, [id]));

/** Deletes a group and all of its categories (see deleteCategory). */
export const deleteGroup = (db: BudgetDB, groupId: string) =>
  db.transaction('rw', [db.groups, db.categories, db.goals, db.monthlyBudgets], async () => {
    const ids = (await db.categories.where('groupId').equals(groupId).primaryKeys()) as string[];
    await deleteCategoriesIn(db, ids);
    await db.groups.delete(groupId);
  });

/** Saves groups and categories whose archived flag changed. */
/** Saves archived or restored groups and categories, and any series paused because of them. */
export const saveArchiveChanges = (db: BudgetDB, groups: CategoryGroup[], categories: Category[], series: RecurringTransaction[] = []) =>
  db.transaction('rw', [db.groups, db.categories, db.recurring], async () => {
    await db.groups.bulkPut(groups);
    await db.categories.bulkPut(categories);
    await db.recurring.bulkPut(series);
  });

export const saveRecurring = (db: BudgetDB, r: RecurringTransaction) => db.recurring.put(r);

/** Saves an account together with series that were paused because of it. */
export const saveAccountAndSeries = (db: BudgetDB, a: Account, series: RecurringTransaction[]) =>
  db.transaction('rw', [db.accounts, db.recurring], async () => {
    await db.accounts.put(a);
    await db.recurring.bulkPut(series);
  });
export const deleteRecurring = (db: BudgetDB, id: string) => db.recurring.delete(id);

/** Saves a template together with the transaction it just booked (if any), atomically. */
export const saveRecurringBooking = (db: BudgetDB, r: RecurringTransaction, booked: Transaction | null) =>
  db.transaction('rw', [db.recurring, db.transactions], async () => {
    await db.recurring.put(r);
    if (booked) await db.transactions.put(booked);
  });

export const saveGoal = (db: BudgetDB, g: Goal) => db.goals.put(g);
export const deleteGoal = (db: BudgetDB, id: string) => db.goals.delete(id);

/** Saves a goal and removes the ones it replaces, all or nothing. */
export const replaceGoal = (db: BudgetDB, g: Goal, replacedIds: string[]) =>
  db.transaction('rw', db.goals, async () => {
    await db.goals.bulkDelete(replacedIds);
    await db.goals.put(g);
  });

/** Removes goals, all or nothing. */
export const deleteGoals = (db: BudgetDB, ids: string[]) => db.goals.bulkDelete(ids);
export const saveTransaction = (db: BudgetDB, t: Transaction) => db.transactions.put(t);
export const saveTransactions = (db: BudgetDB, ts: Transaction[]) => db.transactions.bulkPut(ts);
export const deleteTransaction = (db: BudgetDB, id: string) => db.transactions.delete(id);

/** Sets the Assigned amount for one category in one month. Zero removes the row. */
export async function setAssigned(db: BudgetDB, categoryId: string, month: Month, assigned: Cents) {
  if (assigned === 0) await db.monthlyBudgets.delete([categoryId, month]);
  else await db.monthlyBudgets.put({ categoryId, month, assigned });
}

/** Sets several Assigned amounts for one month, all or nothing. */
export const setAssignedMany = (db: BudgetDB, month: Month, list: { categoryId: string; assigned: Cents }[]) =>
  db.transaction('rw', db.monthlyBudgets, async () => {
    for (const { categoryId, assigned } of list) await setAssigned(db, categoryId, month, assigned);
  });

export async function saveSettings(db: BudgetDB, s: Settings) {
  await db.settings.put({ key: 'currency', value: s.currency });
  if (s.lastBackupAt) await db.settings.put({ key: 'lastBackupAt', value: s.lastBackupAt });
  else await db.settings.delete('lastBackupAt');
}

/** Replaces everything in the database with the given data, atomically. */
export async function replaceAll(db: BudgetDB, state: BudgetState, settings: Settings) {
  await db.transaction(
    'rw',
    [db.accounts, db.groups, db.categories, db.goals, db.monthlyBudgets, db.transactions, db.recurring, db.settings],
    async () => {
      await Promise.all([
        db.accounts.clear(), db.groups.clear(), db.categories.clear(), db.goals.clear(),
        db.monthlyBudgets.clear(), db.transactions.clear(), db.recurring.clear(), db.settings.clear(),
      ]);
      await db.accounts.bulkPut(state.accounts);
      await db.groups.bulkPut(state.groups);
      await db.categories.bulkPut(state.categories);
      await db.goals.bulkPut(state.goals);
      await db.monthlyBudgets.bulkPut(state.monthlyBudgets);
      await db.transactions.bulkPut(state.transactions);
      await db.recurring.bulkPut(state.recurring);
      await saveSettings(db, settings);
    },
  );
}

/** Saves accounts, groups and categories whose sort order changed. */
export const saveOrder = (db: BudgetDB, accounts: Account[], groups: CategoryGroup[], categories: Category[]) =>
  db.transaction('rw', [db.accounts, db.groups, db.categories], async () => {
    await db.accounts.bulkPut(accounts);
    await db.groups.bulkPut(groups);
    await db.categories.bulkPut(categories);
  });
