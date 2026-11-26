import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Account,
  Category,
  CategoryGroup,
  Goal,
  MonthlyBudget,
  RecurringTransaction,
  Transaction,
} from '../engine/types.ts';

export interface SettingRow {
  key: string;
  value: string;
}

export type BudgetDB = Dexie & {
  accounts: EntityTable<Account, 'id'>;
  groups: EntityTable<CategoryGroup, 'id'>;
  categories: EntityTable<Category, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  monthlyBudgets: Table<MonthlyBudget, [string, string]>;
  transactions: EntityTable<Transaction, 'id'>;
  recurring: EntityTable<RecurringTransaction, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

export function createDb(name = 'budget'): BudgetDB {
  const db = new Dexie(name) as BudgetDB;
  db.version(1).stores({
    accounts: 'id',
    groups: 'id',
    categories: 'id, groupId',
    goals: 'id, categoryId',
    monthlyBudgets: '[categoryId+month], month',
    transactions: 'id, accountId, date, categoryId',
    settings: 'key',
  });
  db.version(2).stores({ recurring: 'id' });
  return db;
}
