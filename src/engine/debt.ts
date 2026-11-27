import { RuleError } from './ruleError.ts';
import type { BudgetState, Transaction } from './types.ts';

const isDebtId = (state: BudgetState, id: string | null) => id !== null && state.accounts.some((a) => a.id === id && a.type === 'debt');

/**
 * Checks the rules that keep debts outside the budget. Money can only be spent from a category out of a budget
 * account: a transaction inside a debt account has no category (it only changes what is owed), and a transfer
 * has a category only when it is a payment from a budget account to a debt.
 */
export function checkDebtRules(state: BudgetState, t: Pick<Transaction, 'accountId' | 'transferAccountId' | 'categoryId' | 'splits'>) {
  const hasCategory = t.categoryId !== null || (t.splits?.length ?? 0) > 0;
  const payments = new Set(state.accounts.map((a) => a.paymentCategoryId).filter((id) => id !== undefined));
  if (t.splits?.some((p) => payments.has(p.categoryId))) throw new RuleError('A debt payment cannot be part of a split.');
  if (t.transferAccountId === null) {
    if (isDebtId(state, t.accountId) && hasCategory) throw new RuleError('Spending from a category has to come from a budget account, not from a debt.');
    return;
  }
  if (hasCategory && (isDebtId(state, t.accountId) || !isDebtId(state, t.transferAccountId))) {
    throw new RuleError('Only a payment from a budget account to a debt can have a category.');
  }
}

/** The open debt whose payments are budgeted in this category, if any. */
export const debtForCategory = (state: BudgetState, categoryId: string | null) =>
  categoryId === null ? undefined : state.accounts.find((a) => a.type === 'debt' && !a.closed && a.paymentCategoryId === categoryId);

/**
 * An outflow from a budget account booked on a debt's payment category is a payment to that debt: it becomes a
 * transfer to the debt, so what is owed goes down. Used for everything saved (typed in, imported, recurring), so
 * choosing the category is all it takes.
 */
export function asDebtPayment<T extends Pick<Transaction, 'accountId' | 'transferAccountId' | 'categoryId' | 'splits' | 'amount'>>(state: BudgetState, t: T): T {
  if (t.transferAccountId !== null || t.amount >= 0 || t.splits?.length) return t;
  const debt = debtForCategory(state, t.categoryId);
  if (!debt || debt.id === t.accountId || state.accounts.find((a) => a.id === t.accountId)?.type === 'debt') return t;
  return { ...t, transferAccountId: debt.id };
}
