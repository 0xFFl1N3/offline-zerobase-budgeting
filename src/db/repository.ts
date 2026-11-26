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
  const [accounts, groups, categories, goals, monthlyBudgets, transactions, settingRows] = await Promise.all([
    db.accounts.toArray(),
    db.groups.toArray(),
    db.categories.toArray(),
    db.goals.toArray(),
    db.monthlyBudgets.toArray(),
    db.transactions.toArray(),
    db.settings.toArray(),
  ]);
  const byKey = new Map(settingRows.map((r) => [r.key, r.value]));
  const currency = byKey.get('currency') === 'USD' ? 'USD' : DEFAULT_CURRENCY;
  return {
    state: {
      accounts,
      groups: groups.sort((a, b) => a.sortOrder - b.sortOrder),
      categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
      goals: goals.map(normalizeGoal),
      monthlyBudgets,
      transactions,
    },
    settings: { currency, lastBackupAt: byKey.get('lastBackupAt') ?? null },
  };
}

export const saveAccount = (db: BudgetDB, a: Account) => db.accounts.put(a);
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
export const saveArchiveChanges = (db: BudgetDB, groups: CategoryGroup[], categories: Category[]) =>
  db.transaction('rw', [db.groups, db.categories], async () => {
    await db.groups.bulkPut(groups);
    await db.categories.bulkPut(categories);
  });

export const saveGoal = (db: BudgetDB, g: Goal) => db.goals.put(g);
export const deleteGoal = (db: BudgetDB, id: string) => db.goals.delete(id);
export const saveTransaction = (db: BudgetDB, t: Transaction) => db.transactions.put(t);
export const deleteTransaction = (db: BudgetDB, id: string) => db.transactions.delete(id);

/** Sets the Assigned amount for one category in one month. Zero removes the row. */
export async function setAssigned(db: BudgetDB, categoryId: string, month: Month, assigned: Cents) {
  if (assigned === 0) await db.monthlyBudgets.delete([categoryId, month]);
  else await db.monthlyBudgets.put({ categoryId, month, assigned });
}

export async function saveSettings(db: BudgetDB, s: Settings) {
  await db.settings.put({ key: 'currency', value: s.currency });
  if (s.lastBackupAt) await db.settings.put({ key: 'lastBackupAt', value: s.lastBackupAt });
  else await db.settings.delete('lastBackupAt');
}

/** Replaces everything in the database with the given data, atomically. */
export async function replaceAll(db: BudgetDB, state: BudgetState, settings: Settings) {
  await db.transaction(
    'rw',
    [db.accounts, db.groups, db.categories, db.goals, db.monthlyBudgets, db.transactions, db.settings],
    async () => {
      await Promise.all([
        db.accounts.clear(), db.groups.clear(), db.categories.clear(), db.goals.clear(),
        db.monthlyBudgets.clear(), db.transactions.clear(), db.settings.clear(),
      ]);
      await db.accounts.bulkPut(state.accounts);
      await db.groups.bulkPut(state.groups);
      await db.categories.bulkPut(state.categories);
      await db.goals.bulkPut(state.goals);
      await db.monthlyBudgets.bulkPut(state.monthlyBudgets);
      await db.transactions.bulkPut(state.transactions);
      await saveSettings(db, settings);
    },
  );
}
