import type { Account, BudgetState, Cents, ClearedStatus, Transaction } from './types.ts';
import { RuleError } from './ruleError.ts';

export const ADJUSTMENT_PAYEE = 'Reconciliation adjustment';

/** True if the transaction moves money in or out of the account. */
export const touchesAccount = (t: Transaction, accountId: string) => t.accountId === accountId || t.transferAccountId === accountId;

/** The status on one account's side of the transaction (a transfer has one per account). */
export function clearedStatus(t: Transaction, accountId: string): ClearedStatus {
  const status = t.accountId === accountId ? t.cleared : t.transferAccountId === accountId ? t.transferCleared : undefined;
  return status ?? 'uncleared';
}

/** A copy with the status of the account's side changed. */
export function withCleared(t: Transaction, accountId: string, status: ClearedStatus): Transaction {
  if (t.accountId === accountId) return { ...t, cleared: status };
  if (t.transferAccountId === accountId) return { ...t, transferCleared: status };
  throw new RuleError('That transaction is not in this account.');
}

/** True if either side is reconciled; changing such a transaction should be confirmed first. */
export const isReconciled = (t: Transaction) => t.cleared === 'reconciled' || t.transferCleared === 'reconciled';

/** Amount of the transaction as seen from the account (a transfer is negative on the sending side). */
const signedFor = (t: Transaction, accountId: string): Cents => (t.accountId === accountId ? t.amount : -t.amount);

export interface AccountBalances {
  /** Opening balance plus cleared and reconciled transactions: what the bank should show. */
  cleared: Cents;
  /** Transactions not on the statement yet. */
  uncleared: Cents;
  /** cleared + uncleared. */
  working: Cents;
  /** Cleared (not yet reconciled) transactions: these are locked in when reconciling finishes. */
  clearedCount: number;
}

export function accountBalances(state: BudgetState, accountId: string): AccountBalances {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) throw new RuleError(`Unknown account: ${accountId}`);
  let cleared = account.openingBalance;
  let uncleared = 0;
  let clearedCount = 0;
  for (const t of state.transactions) {
    if (!touchesAccount(t, accountId)) continue;
    const status = clearedStatus(t, accountId);
    if (status === 'uncleared') uncleared += signedFor(t, accountId);
    else cleared += signedFor(t, accountId);
    if (status === 'cleared') clearedCount++;
  }
  return { cleared, uncleared, working: cleared + uncleared, clearedCount };
}

/**
 * Keeps the cleared status through an edit, side by side: a side keeps it while it stays in the same account.
 * Moving a transaction to another account makes it uncleared there. The import id (if any) is kept too.
 */
export function keepCleared(original: Transaction | undefined, edited: Transaction): Transaction {
  const { cleared: _c, transferCleared: _tc, ...rest } = edited;
  const next: Transaction = rest;
  if (!original) return next;
  if (original.importId !== undefined) next.importId = original.importId; // still the same bank row
  if (original.importPending) next.importPending = true;
  if (original.cleared && original.accountId === edited.accountId) next.cleared = original.cleared;
  if (original.transferCleared && edited.transferAccountId !== null && original.transferAccountId === edited.transferAccountId) {
    next.transferCleared = original.transferCleared;
  }
  return next;
}

export interface ReconcileOptions {
  today: string;
  /** Id for the adjustment transaction, used only when the balances differ. */
  adjustmentId: string;
  /** Category of the adjustment. Required when it lowers the balance; for a raise, null means income. */
  categoryId: string | null;
}

export interface ReconcileResult {
  state: BudgetState;
  account: Account;
  /** Every transaction that was added or changed. */
  changed: Transaction[];
  adjustment: Transaction | null;
}

/**
 * Finishes reconciling: if the statement differs from the cleared balance, an adjustment closes the gap;
 * then every cleared transaction of the account becomes reconciled.
 */
export function reconcile(state: BudgetState, accountId: string, statementBalance: Cents, options: ReconcileOptions): ReconcileResult {
  const difference = statementBalance - accountBalances(state, accountId).cleared;
  // On a debt or a tracking account the difference only changes what is owed or worth: it is outside the budget,
  // so it has no category.
  const kind = state.accounts.find((a) => a.id === accountId)?.type;
  const debt = kind === 'debt' || kind === 'tracking';
  const categoryId = debt ? null : options.categoryId;
  if (difference < 0 && categoryId === null && !debt) throw new RuleError('An adjustment that lowers the balance needs a category.');
  const adjustment: Transaction | null =
    difference === 0
      ? null
      : {
          id: options.adjustmentId,
          accountId,
          date: options.today,
          payee: ADJUSTMENT_PAYEE,
          categoryId,
          memo: '',
          amount: difference,
          transferAccountId: null,
          cleared: 'reconciled',
        };

  const changed: Transaction[] = [];
  const transactions = state.transactions.map((t) => {
    if (!touchesAccount(t, accountId) || clearedStatus(t, accountId) !== 'cleared') return t;
    const next = withCleared(t, accountId, 'reconciled');
    changed.push(next);
    return next;
  });
  if (adjustment) {
    transactions.push(adjustment);
    changed.push(adjustment);
  }
  const account = { ...state.accounts.find((a) => a.id === accountId)!, lastReconciled: options.today };
  return {
    state: { ...state, transactions, accounts: state.accounts.map((a) => (a.id === accountId ? account : a)) },
    account,
    changed,
    adjustment,
  };
}
