import type { Currency } from '../engine/money.ts';
import type {
  Account,
  AccountType,
  BudgetState,
  Category,
  CategoryGroup,
  Goal,
  MonthlyBudget,
  Transaction,
  TransactionSplit,
} from '../engine/types.ts';

export const BACKUP_APP = 'budgeting-app';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  settings: { currency: Currency };
  data: BudgetState;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function createBackup(state: BudgetState, currency: Currency, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), settings: { currency }, data: state };
}

export const serializeBackup = (backup: BackupFile): string => JSON.stringify(backup, null, 2);

// ---- validation -------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_TYPES: AccountType[] = ['checking', 'cash', 'savings'];

function list(data: Obj, key: string): Obj[] {
  const v = data[key];
  if (!Array.isArray(v)) throw new Error(`The file has no "${key}" list.`);
  return v.map((item) => {
    if (!isObj(item)) throw new Error(`An entry in "${key}" is not a valid record.`);
    return item;
  });
}
const str = (o: Obj, k: string, what: string): string => {
  const v = o[k];
  if (typeof v !== 'string') throw new Error(`${what}: "${k}" must be text.`);
  return v;
};
const int = (o: Obj, k: string, what: string): number => {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error(`${what}: "${k}" must be a whole number of cents.`);
  return v;
};
const bool = (o: Obj, k: string, what: string): boolean => {
  const v = o[k];
  if (typeof v !== 'boolean') throw new Error(`${what}: "${k}" must be true or false.`);
  return v;
};
const optStr = (o: Obj, k: string, what: string): string | null => {
  const v = o[k];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new Error(`${what}: "${k}" must be text or empty.`);
  return v;
};

function parseGoal(o: Obj): Goal {
  const what = 'Goal';
  const id = str(o, 'id', what);
  const categoryId = str(o, 'categoryId', what);
  const type = str(o, 'type', what);
  if (type === 'monthly_amount') return { id, categoryId, type, monthlyAmount: int(o, 'monthlyAmount', what) };
  if (type !== 'target_balance' && type !== 'target_by_date') throw new Error(`Goal: unknown type "${type}".`);
  const targetDate = o['targetDate'];
  if (targetDate !== undefined && (typeof targetDate !== 'string' || !MONTH.test(targetDate))) {
    throw new Error('Goal: "targetDate" must look like 2026-06.');
  }
  return {
    id,
    categoryId,
    type: 'target_balance', // legacy "target_by_date" is read as target_balance
    targetAmount: int(o, 'targetAmount', what),
    ...(typeof targetDate === 'string' ? { targetDate } : {}),
  };
}

function unique(ids: string[], what: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`The file has duplicate ${what} ids.`);
}

/** Reads the optional `splits` of a transaction: two or more parts that add up to the transaction's amount. */
function parseSplits(o: Obj): { splits?: TransactionSplit[] } {
  if (o.splits === undefined) return {};
  if (!Array.isArray(o.splits)) throw new Error('Transaction: "splits" must be a list.');
  const splits = o.splits.map((item) => {
    if (!isObj(item)) throw new Error('Transaction: a split is not a valid record.');
    return { categoryId: str(item, 'categoryId', 'Split'), amount: int(item, 'amount', 'Split') };
  });
  const amount = int(o, 'amount', 'Transaction');
  if (splits.length < 2) throw new Error('Transaction: a split needs at least two parts.');
  if (splits.reduce((sum, s) => sum + s.amount, 0) !== amount) throw new Error('Transaction: the parts of a split must add up to its amount.');
  if (optStr(o, 'categoryId', 'Transaction') !== null || optStr(o, 'transferAccountId', 'Transaction') !== null) {
    throw new Error('Transaction: a split cannot also have a category or be a transfer.');
  }
  return { splits };
}

function parseData(raw: unknown): BudgetState {
  if (!isObj(raw)) throw new Error('The file has no data section.');
  const accounts: Account[] = list(raw, 'accounts').map((o, index) => {
    const type = str(o, 'type', 'Account') as AccountType;
    if (!ACCOUNT_TYPES.includes(type)) throw new Error(`Account: unknown type "${type}".`);
    return { id: str(o, 'id', 'Account'), name: str(o, 'name', 'Account'), type, openingBalance: int(o, 'openingBalance', 'Account'), sortOrder: o.sortOrder === undefined ? index : int(o, 'sortOrder', 'Account'), closed: bool(o, 'closed', 'Account') };
  });
  const groups: CategoryGroup[] = list(raw, 'groups').map((o) => ({
    id: str(o, 'id', 'Group'), name: str(o, 'name', 'Group'), sortOrder: int(o, 'sortOrder', 'Group'), archived: bool(o, 'archived', 'Group'),
  }));
  const categories: Category[] = list(raw, 'categories').map((o) => ({
    id: str(o, 'id', 'Category'), groupId: str(o, 'groupId', 'Category'), name: str(o, 'name', 'Category'),
    sortOrder: int(o, 'sortOrder', 'Category'), archived: bool(o, 'archived', 'Category'),
  }));
  const goals: Goal[] = list(raw, 'goals').map(parseGoal);
  const monthlyBudgets: MonthlyBudget[] = list(raw, 'monthlyBudgets').map((o) => {
    const month = str(o, 'month', 'Assignment');
    if (!MONTH.test(month)) throw new Error('Assignment: "month" must look like 2026-06.');
    return { categoryId: str(o, 'categoryId', 'Assignment'), month, assigned: int(o, 'assigned', 'Assignment') };
  });
  const transactions: Transaction[] = list(raw, 'transactions').map((o) => {
    const date = str(o, 'date', 'Transaction');
    if (!DATE.test(date)) throw new Error('Transaction: "date" must look like 2026-06-15.');
    return {
      id: str(o, 'id', 'Transaction'), accountId: str(o, 'accountId', 'Transaction'), date,
      payee: str(o, 'payee', 'Transaction'), categoryId: optStr(o, 'categoryId', 'Transaction'),
      memo: str(o, 'memo', 'Transaction'), amount: int(o, 'amount', 'Transaction'),
      transferAccountId: optStr(o, 'transferAccountId', 'Transaction'),
      ...parseSplits(o),
    };
  });

  unique(accounts.map((a) => a.id), 'account');
  unique(groups.map((g) => g.id), 'group');
  unique(categories.map((c) => c.id), 'category');
  unique(goals.map((g) => g.id), 'goal');
  unique(transactions.map((t) => t.id), 'transaction');

  const accountIds = new Set(accounts.map((a) => a.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  for (const c of categories) if (!groupIds.has(c.groupId)) throw new Error(`Category "${c.name}" points to a missing group.`);
  for (const g of goals) if (!categoryIds.has(g.categoryId)) throw new Error('A goal points to a missing category.');
  for (const b of monthlyBudgets) if (!categoryIds.has(b.categoryId)) throw new Error('An assignment points to a missing category.');
  for (const t of transactions) {
    if (!accountIds.has(t.accountId)) throw new Error('A transaction points to a missing account.');
    if (t.transferAccountId !== null && !accountIds.has(t.transferAccountId)) throw new Error('A transfer points to a missing account.');
    if (t.categoryId !== null && !categoryIds.has(t.categoryId)) throw new Error('A transaction points to a missing category.');
    for (const part of t.splits ?? []) if (!categoryIds.has(part.categoryId)) throw new Error('A split points to a missing category.');
  }
  return { accounts, groups, categories, goals, monthlyBudgets, transactions };
}

/** Parses and strictly validates a backup file's text. Never throws. */
export function parseBackup(text: string): ParseResult {
  try {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('This is not a valid backup file (it is not JSON).');
    }
    if (!isObj(json) || json['app'] !== BACKUP_APP) throw new Error('This file was not created by this app.');
    const version = json['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new Error('The backup has no valid version.');
    if (version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app. Update the app first.');
    const settings = json['settings'];
    const currency = isObj(settings) && settings['currency'] === 'USD' ? 'USD' : 'EUR';
    const exportedAt = typeof json['exportedAt'] === 'string' ? json['exportedAt'] : '';
    return { ok: true, backup: { app: BACKUP_APP, version, exportedAt, settings: { currency }, data: parseData(json['data']) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The backup file could not be read.' };
  }
}
