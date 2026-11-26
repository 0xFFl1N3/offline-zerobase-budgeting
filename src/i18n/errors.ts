import { t, type MessageKey } from './i18n.ts';

/**
 * The calculation, storage and backup code report problems in English (their tests rely on it).
 * This turns those messages into the current language for display. Unknown messages are shown as they are.
 */
const EXACT: Record<string, MessageKey> = {
  'A category with transactions cannot be deleted. Archive it instead.': 'error.categoryHasTransactions',
  'An account needs a name.': 'account.errorName',
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
