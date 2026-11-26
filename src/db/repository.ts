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

export interface Settings {
  currency: Currency;
}

const DEFAULT_SETTINGS: Settings = { currency: 'EUR' };

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
  const currency = byKey.get('currency') === 'USD' ? 'USD' : DEFAULT_SETTINGS.currency;
  return {
    state: {
      accounts,
      groups: groups.sort((a, b) => a.sortOrder - b.sortOrder),
      categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
      goals,
      monthlyBudgets,
      transactions,
    },
    settings: { currency },
  };
}

export const saveAccount = (db: BudgetDB, a: Account) => db.accounts.put(a);
export const saveGroup = (db: BudgetDB, g: CategoryGroup) => db.groups.put(g);
export const saveCategory = (db: BudgetDB, c: Category) => db.categories.put(c);
export const saveGoal = (db: BudgetDB, g: Goal) => db.goals.put(g);
export const deleteGoal = (db: BudgetDB, id: string) => db.goals.delete(id);
export const saveTransaction = (db: BudgetDB, t: Transaction) => db.transactions.put(t);
export const deleteTransaction = (db: BudgetDB, id: string) => db.transactions.delete(id);

/** Sets the Assigned amount for one category in one month. Zero removes the row. */
export async function setAssigned(db: BudgetDB, categoryId: string, month: Month, assigned: Cents) {
  if (assigned === 0) await db.monthlyBudgets.delete([categoryId, month]);
  else await db.monthlyBudgets.put({ categoryId, month, assigned });
}

export const saveSettings = (db: BudgetDB, s: Settings) =>
  db.settings.put({ key: 'currency', value: s.currency });
