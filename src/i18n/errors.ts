import { t, type MessageKey } from './i18n.ts';

/**
 * The calculation, storage and backup code report problems in English (their tests rely on it).
 * This turns those messages into the current language for display. Unknown messages are shown as they are.
 */
const EXACT: Record<string, MessageKey> = {
  'A category with transactions cannot be deleted. Archive it instead.': 'error.categoryHasTransactions',
  'An account needs a name.': 'account.errorName',
  "A debt's payment category cannot be deleted while the debt exists. Archive it instead.": 'error.paymentCategory',
  'A debt cannot be changed into another kind of account, or the other way round.': 'error.debtType',
  'Enter what is still owed as a positive amount.': 'error.owedPositive',
  'Spending from a category has to come from a budget account, not from a debt.': 'error.debtSpending',
  'Only a payment from a budget account to a debt can have a category.': 'error.debtTransferCategory',
  'Money moved into a tracking account needs the category it comes from.': 'error.trackingCategory',
  'A debt payment cannot be part of a split.': 'error.debtSplit',
  'Move the remaining balance to another account before closing this one.': 'error.closeWithBalance',
  'An account with transactions cannot be deleted. Close it instead.': 'error.accountHasTransactions',
  'Categories can only be reordered within their group.': 'error.reorderGroup',
  'An adjustment that lowers the balance needs a category.': 'error.adjustmentCategory',
  'This recurring transaction has ended.': 'error.recurringEnded',
  'The end date cannot be before the first date.': 'error.endBeforeStart',
  'Enter an amount greater than zero.': 'tx.errorPositive',
  'No valid date': 'import.problemDate',
  'No valid amount': 'import.problemAmount',
  'Amount is zero': 'import.problemZero',
  'This is not a valid backup file (it is not JSON).': 'error.backupNotJson',
  'This file was not created by this app.': 'error.backupOtherApp',
  'The backup has no valid version.': 'error.backupVersion',
  'This backup was made by a newer version of the app. Update the app first.': 'error.backupNewer',
  'The backup file could not be read.': 'error.backupUnreadable',
  'The file assigns money to the same category twice in one month.': 'error.backupDuplicateAssignment',
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Row (\d+) needs a category\.$/, (m) => t('import.rowNeedsCategory', { row: m[1]! })],
  [/^Row (\d+): (.+)\.$/, (m) => t('import.rowProblem', { row: m[1]!, problem: errorText(m[2]!) })],
];

/**
 * Text to show for an error or an error message, in the current language.
 * `wrap` frames a message that has no translation, e.g. the detailed backup checks (it gets {detail}).
 */
export function errorText(error: unknown, wrap?: MessageKey): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return t('account.errorGeneric');
  const key = EXACT[message];
  if (key) return t(key);
  for (const [pattern, render] of PATTERNS) {
    const m = message.match(pattern);
    if (m) return render(m);
  }
  return wrap ? t(wrap, { detail: message }) : message;
}

// --- What an error means -------------------------------------------------------------------------------
// The one place that decides how a failure is shown. The store reports storage and unexpected errors in
// the error bar; rule errors are shown next to what was clicked (see useAction).

/** A problem to show in the error bar. Text is looked up when shown, so it follows the language. */
export interface Problem {
  kind: 'storage' | 'unexpected' | 'rule';
  message: MessageKey;
  /** Shown as {detail} where the message has it (the technical reason, or a rule error's text). */
  detail: string;
  /** Reloading the page is likely to help. */
  reload: boolean;
}

/** Browser database errors (by name, as IndexedDB and Dexie report them) and the message for each. */
const STORAGE: Record<string, { message: MessageKey; reload: boolean }> = {
  QuotaExceededError: { message: 'error.storageFull', reload: false },
  DatabaseClosedError: { message: 'error.storageClosed', reload: true },
  VersionChangeError: { message: 'error.storageClosed', reload: true },
  VersionError: { message: 'error.storageClosed', reload: true },
  OpenFailedError: { message: 'error.storageBlocked', reload: true },
  MissingAPIError: { message: 'error.storageBlocked', reload: false },
  SecurityError: { message: 'error.storageBlocked', reload: false },
  InvalidStateError: { message: 'error.storageFailed', reload: true },
  TransactionInactiveError: { message: 'error.storageFailed', reload: true },
  AbortError: { message: 'error.storageFailed', reload: true },
  ReadOnlyError: { message: 'error.storageFailed', reload: true },
  UnknownError: { message: 'error.storageFailed', reload: true },
  DataError: { message: 'error.storageFailed', reload: true },
  ConstraintError: { message: 'error.storageFailed', reload: true },
  TimeoutError: { message: 'error.storageFailed', reload: true },
};

function names(error: unknown): string[] {
  const found: string[] = [];
  // Dexie wraps the browser's error and keeps it as `inner`.
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 4; e = (e as { inner?: unknown }).inner, depth++) {
    const name = (e as { name?: unknown }).name;
    if (typeof name === 'string') found.push(name);
  }
  return found;
}

export function classify(error: unknown): Problem {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  if (error instanceof Error && error.name === 'RuleError') return { kind: 'rule', message: 'error.rule', detail: errorText(error), reload: false };
  // The most specific (innermost) known name wins, e.g. a QuotaExceededError inside a Dexie AbortError.
  for (const name of names(error).reverse()) {
    const known = STORAGE[name];
    if (known) return { kind: 'storage', ...known, detail };
  }
  return { kind: 'unexpected', message: 'error.unexpected', detail, reload: true };
}

const REPORTED = Symbol('reported');

/** Marks an error as already shown, so the safety net for unhandled errors does not show it again. */
export function markReported<T>(error: T): T {
  if (error && typeof error === 'object') (error as Record<symbol, boolean>)[REPORTED] = true;
  return error;
}

export const isReported = (error: unknown): boolean => !!error && typeof error === 'object' && (error as Record<symbol, boolean>)[REPORTED] === true;
