import type { Currency } from '../engine/money.ts';
import type {
  ClearedStatus,
  Account,
  AccountType,
  BudgetState,
  Category,
  CategoryGroup,
  Frequency,
  Goal,
  MonthlyBudget,
  RepeatMonths,
  RecurringTransaction,
  Transaction,
  TransactionSplit,
} from '../engine/types.ts';
import { RuleError } from '../engine/ruleError.ts';
import { checkDebtRules } from '../engine/debt.ts';
import { REPEAT_MONTHS } from '../engine/types.ts';

export const BACKUP_APP = 'budgeting-app';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  /** demo: the data is the app's sample data; it comes back as sample data when restored. */
  settings: { currency: Currency; demo?: true };
  data: BudgetState;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function createBackup(state: BudgetState, currency: Currency, now: Date = new Date(), demo = false): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), settings: demo ? { currency, demo: true } : { currency }, data: state };
}

export const serializeBackup = (backup: BackupFile): string => JSON.stringify(backup, null, 2);

// ---- validation -------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_TYPES: AccountType[] = ['checking', 'cash', 'savings', 'debt', 'tracking'];

function list(data: Obj, key: string): Obj[] {
  const v = data[key];
  if (!Array.isArray(v)) throw new RuleError(`The file has no "${key}" list.`);
  return v.map((item) => {
    if (!isObj(item)) throw new RuleError(`An entry in "${key}" is not a valid record.`);
    return item;
  });
}
const str = (o: Obj, k: string, what: string): string => {
  const v = o[k];
  if (typeof v !== 'string') throw new RuleError(`${what}: "${k}" must be text.`);
  return v;
};
const int = (o: Obj, k: string, what: string): number => {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new RuleError(`${what}: "${k}" must be a whole number of cents.`);
  return v;
};
const bool = (o: Obj, k: string, what: string): boolean => {
  const v = o[k];
  if (typeof v !== 'boolean') throw new RuleError(`${what}: "${k}" must be true or false.`);
  return v;
};
const optStr = (o: Obj, k: string, what: string): string | null => {
  const v = o[k];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new RuleError(`${what}: "${k}" must be text or empty.`);
  return v;
};

function parseGoal(o: Obj): Goal {
  const goal = parseGoalBody(o);
  const paused = o['pausedMonths'];
  if (paused === undefined) return goal;
  if (!Array.isArray(paused) || !paused.every((m) => typeof m === 'string' && MONTH.test(m))) {
    throw new RuleError('Goal: "pausedMonths" must be a list of months like 2026-06.');
  }
  return { ...goal, pausedMonths: paused as string[] };
}

function parseGoalBody(o: Obj): Goal {
  const what = 'Goal';
  const id = str(o, 'id', what);
  const categoryId = str(o, 'categoryId', what);
  const type = str(o, 'type', what);
  if (type === 'monthly_amount') return { id, categoryId, type, monthlyAmount: int(o, 'monthlyAmount', what) };
  if (type !== 'target_balance' && type !== 'target_by_date') throw new RuleError(`Goal: unknown type "${type}".`);
  const targetDate = o['targetDate'];
  if (targetDate !== undefined && (typeof targetDate !== 'string' || !MONTH.test(targetDate))) {
    throw new RuleError('Goal: "targetDate" must look like 2026-06.');
  }
  const repeatMonths = o['repeatMonths'];
  if (repeatMonths !== undefined && (!REPEAT_MONTHS.includes(repeatMonths as RepeatMonths) || typeof targetDate !== 'string')) {
    throw new RuleError('Goal: "repeatMonths" must be 3, 6 or 12, and needs a "targetDate".');
  }
  return {
    id,
    categoryId,
    type: 'target_balance', // legacy "target_by_date" is read as target_balance
    targetAmount: int(o, 'targetAmount', what),
    ...(typeof targetDate === 'string' ? { targetDate } : {}),
    ...(repeatMonths !== undefined ? { repeatMonths: repeatMonths as RepeatMonths } : {}),
  };
}

function unique(ids: string[], what: string) {
  if (new Set(ids).size !== ids.length) throw new RuleError(`The file has duplicate ${what} ids.`);
}

/** Reads the optional `splits` of a transaction: two or more parts that add up to the transaction's amount. */
function parseSplits(o: Obj): { splits?: TransactionSplit[] } {
  if (o.splits === undefined) return {};
  if (!Array.isArray(o.splits)) throw new RuleError('Transaction: "splits" must be a list.');
  const splits = o.splits.map((item) => {
    if (!isObj(item)) throw new RuleError('Transaction: a split is not a valid record.');
    return { categoryId: str(item, 'categoryId', 'Split'), amount: int(item, 'amount', 'Split') };
  });
  const amount = int(o, 'amount', 'Transaction');
  if (splits.length < 2) throw new RuleError('Transaction: a split needs at least two parts.');
  if (splits.reduce((sum, s) => sum + s.amount, 0) !== amount) throw new RuleError('Transaction: the parts of a split must add up to its amount.');
  if (optStr(o, 'categoryId', 'Transaction') !== null || optStr(o, 'transferAccountId', 'Transaction') !== null) {
    throw new RuleError('Transaction: a split cannot also have a category or be a transfer.');
  }
  return { splits };
}

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

/** Backups made before recurring transactions existed have no "recurring" list: that means none. */
const CLEARED: ClearedStatus[] = ['uncleared', 'cleared', 'reconciled'];

/** Cleared status of each side; backups made before reconciling existed have none (uncleared). */
function parseCleared(o: Obj): { cleared?: ClearedStatus; transferCleared?: ClearedStatus } {
  const result: { cleared?: ClearedStatus; transferCleared?: ClearedStatus } = {};
  for (const key of ['cleared', 'transferCleared'] as const) {
    if (o[key] === undefined) continue;
    const value = str(o, key, 'Transaction') as ClearedStatus;
    if (!CLEARED.includes(value)) throw new RuleError(`Transaction: unknown ${key} status "${value}".`);
    result[key] = value;
  }
  if (result.transferCleared !== undefined && optStr(o, 'transferAccountId', 'Transaction') === null) {
    throw new RuleError('Transaction: only a transfer has a status for the receiving account.');
  }
  return result;
}

function parseRecurring(raw: Obj): RecurringTransaction[] {
  if (raw.recurring === undefined) return [];
  return list(raw, 'recurring').map((o) => {
    const frequency = str(o, 'frequency', 'Recurring') as Frequency;
    if (!FREQUENCIES.includes(frequency)) throw new RuleError(`Recurring: unknown frequency "${frequency}".`);
    const startDate = str(o, 'startDate', 'Recurring');
    if (!DATE.test(startDate)) throw new RuleError('Recurring: "startDate" must look like 2026-06-15.');
    const endDate = optStr(o, 'endDate', 'Recurring');
    if (endDate !== null && !DATE.test(endDate)) throw new RuleError('Recurring: "endDate" must look like 2026-06-15.');
    const handled = int(o, 'handled', 'Recurring');
    if (handled < 0) throw new RuleError('Recurring: "handled" cannot be negative.');
    const t = o.template;
    if (!isObj(t)) throw new RuleError('Recurring: "template" is missing.');
    return {
      id: str(o, 'id', 'Recurring'),
      frequency,
      startDate,
      endDate,
      handled,
      paused: bool(o, 'paused', 'Recurring'),
      template: {
        accountId: str(t, 'accountId', 'Recurring'),
        payee: str(t, 'payee', 'Recurring'),
        categoryId: optStr(t, 'categoryId', 'Recurring'),
        memo: str(t, 'memo', 'Recurring'),
        amount: int(t, 'amount', 'Recurring'),
        transferAccountId: optStr(t, 'transferAccountId', 'Recurring'),
        ...parseSplits(t),
      },
    };
  });
}

function parseLastReconciled(o: Obj): { lastReconciled?: string } {
  if (o.lastReconciled === undefined) return {};
  const date = str(o, 'lastReconciled', 'Account');
  if (!DATE.test(date)) throw new RuleError('Account: "lastReconciled" must look like 2026-06-15.');
  return { lastReconciled: date };
}

function parseData(raw: unknown): BudgetState {
  if (!isObj(raw)) throw new RuleError('The file has no data section.');
  const accounts: Account[] = list(raw, 'accounts').map((o, index) => {
    const type = str(o, 'type', 'Account') as AccountType;
    if (!ACCOUNT_TYPES.includes(type)) throw new RuleError(`Account: unknown type "${type}".`);
    return {
      id: str(o, 'id', 'Account'), name: str(o, 'name', 'Account'), type, openingBalance: int(o, 'openingBalance', 'Account'),
      sortOrder: o.sortOrder === undefined ? index : int(o, 'sortOrder', 'Account'), closed: bool(o, 'closed', 'Account'), ...parseLastReconciled(o),
      ...(o.paymentCategoryId !== undefined && { paymentCategoryId: str(o, 'paymentCategoryId', 'Account') }),
      ...(o.minimumPayment !== undefined && { minimumPayment: int(o, 'minimumPayment', 'Account') }),
    };
  });
  const groups: CategoryGroup[] = list(raw, 'groups').map((o) => ({
    id: str(o, 'id', 'Group'), name: str(o, 'name', 'Group'), sortOrder: int(o, 'sortOrder', 'Group'), archived: bool(o, 'archived', 'Group'),
  }));
  const categories: Category[] = list(raw, 'categories').map((o) => ({
    id: str(o, 'id', 'Category'), groupId: str(o, 'groupId', 'Category'), name: str(o, 'name', 'Category'),
    sortOrder: int(o, 'sortOrder', 'Category'), archived: bool(o, 'archived', 'Category'),
  }));
  const goals: Goal[] = list(raw, 'goals').map(parseGoal);
  const recurring = parseRecurring(raw);
  const monthlyBudgets: MonthlyBudget[] = list(raw, 'monthlyBudgets').map((o) => {
    const month = str(o, 'month', 'Assignment');
    if (!MONTH.test(month)) throw new RuleError('Assignment: "month" must look like 2026-06.');
    return { categoryId: str(o, 'categoryId', 'Assignment'), month, assigned: int(o, 'assigned', 'Assignment') };
  });
  const transactions: Transaction[] = list(raw, 'transactions').map((o) => {
    const date = str(o, 'date', 'Transaction');
    if (!DATE.test(date)) throw new RuleError('Transaction: "date" must look like 2026-06-15.');
    return {
      id: str(o, 'id', 'Transaction'), accountId: str(o, 'accountId', 'Transaction'), date,
      payee: str(o, 'payee', 'Transaction'), categoryId: optStr(o, 'categoryId', 'Transaction'),
      memo: str(o, 'memo', 'Transaction'), amount: int(o, 'amount', 'Transaction'),
      transferAccountId: optStr(o, 'transferAccountId', 'Transaction'),
      ...parseSplits(o),
      ...parseCleared(o),
      ...(o.importId !== undefined && { importId: str(o, 'importId', 'Transaction') }),
      ...(o.importPending !== undefined && { importPending: bool(o, 'importPending', 'Transaction') }),
    };
  });

  unique(accounts.map((a) => a.id), 'account');
  unique(groups.map((g) => g.id), 'group');
  unique(categories.map((c) => c.id), 'category');
  unique(goals.map((g) => g.id), 'goal');
  unique(transactions.map((t) => t.id), 'transaction');
  unique(recurring.map((r) => r.id), 'recurring transaction');
  // The database keeps one assignment per category and month; a second one would be lost without a word.
  if (new Set(monthlyBudgets.map((b) => `${b.categoryId}|${b.month}`)).size !== monthlyBudgets.length) {
    throw new RuleError('The file assigns money to the same category twice in one month.');
  }

  const accountIds = new Set(accounts.map((a) => a.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  for (const c of categories) if (!groupIds.has(c.groupId)) throw new RuleError(`Category "${c.name}" points to a missing group.`);
  for (const g of goals) if (!categoryIds.has(g.categoryId)) throw new RuleError('A goal points to a missing category.');
  for (const b of monthlyBudgets) if (!categoryIds.has(b.categoryId)) throw new RuleError('An assignment points to a missing category.');
  for (const a of accounts) if (a.paymentCategoryId !== undefined && !categoryIds.has(a.paymentCategoryId)) throw new RuleError('A debt points to a missing category.');
  for (const t of transactions) {
    if (!accountIds.has(t.accountId)) throw new RuleError('A transaction points to a missing account.');
    if (t.transferAccountId !== null && !accountIds.has(t.transferAccountId)) throw new RuleError('A transfer points to a missing account.');
    if (t.categoryId !== null && !categoryIds.has(t.categoryId)) throw new RuleError('A transaction points to a missing category.');
    for (const part of t.splits ?? []) if (!categoryIds.has(part.categoryId)) throw new RuleError('A split points to a missing category.');
  }
  // The same rules the app applies when saving: what may have a category in and out of debts and tracking accounts.
  const state = { accounts, groups, categories, goals, monthlyBudgets, transactions, recurring };
  for (const t of transactions) if (t.transferAccountId === null || accountIds.has(t.transferAccountId)) checkDebtRules(state, t);
  for (const r of recurring) {
    const t = r.template;
    if (!accountIds.has(t.accountId)) throw new RuleError('A recurring transaction points to a missing account.');
    if (t.transferAccountId !== null && !accountIds.has(t.transferAccountId)) throw new RuleError('A recurring transfer points to a missing account.');
    if (t.categoryId !== null && !categoryIds.has(t.categoryId)) throw new RuleError('A recurring transaction points to a missing category.');
    for (const part of t.splits ?? []) if (!categoryIds.has(part.categoryId)) throw new RuleError('A recurring split points to a missing category.');
  }
  return { accounts, groups, categories, goals, monthlyBudgets, transactions, recurring };
}

/** Parses and strictly validates a backup file's text. Never throws. */
export function parseBackup(text: string): ParseResult {
  try {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new RuleError('This is not a valid backup file (it is not JSON).');
    }
    if (!isObj(json) || json['app'] !== BACKUP_APP) throw new RuleError('This file was not created by this app.');
    const version = json['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new RuleError('The backup has no valid version.');
    if (version > BACKUP_VERSION) throw new RuleError('This backup was made by a newer version of the app. Update the app first.');
    const settings = json['settings'];
    const currency = isObj(settings) && settings['currency'] === 'USD' ? 'USD' : 'EUR';
    const exportedAt = typeof json['exportedAt'] === 'string' ? json['exportedAt'] : '';
    const demo = isObj(settings) && settings['demo'] === true;
    return { ok: true, backup: { app: BACKUP_APP, version, exportedAt, settings: demo ? { currency, demo } : { currency }, data: parseData(json['data']) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The backup file could not be read.' };
  }
}
