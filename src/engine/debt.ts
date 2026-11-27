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
  if (t.transferAccountId === null) {
    if (isDebtId(state, t.accountId) && hasCategory) throw new RuleError('Spending from a category has to come from a budget account, not from a debt.');
    return;
  }
  if (hasCategory && (isDebtId(state, t.accountId) || !isDebtId(state, t.transferAccountId))) {
    throw new RuleError('Only a payment from a budget account to a debt can have a category.');
  }
}
