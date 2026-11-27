import { RuleError } from './ruleError.ts';
import { accountBalance } from './budget.ts';
import { addMonths } from './months.ts';
import type { Account, BudgetState, Cents, Month, Transaction } from './types.ts';

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

export interface PayoffForecast {
  /** Payments still to make (0 when nothing is owed). */
  payments: number;
  /** Month of the last payment. */
  lastMonth: Month;
  /** The last payment, usually smaller than the others. */
  lastAmount: Cents;
}

/**
 * When a debt is paid off with a fixed monthly payment (no interest: the amount owed already includes it).
 * `extra` is a one-time payment on top of the first one. Returns null when the payment is not positive.
 */
export function payoffForecast(owed: Cents, monthly: Cents, firstMonth: Month, extra: Cents = 0): PayoffForecast | null {
  const left = Math.max(0, owed - Math.max(0, extra));
  if (owed <= 0) return { payments: 0, lastMonth: firstMonth, lastAmount: 0 };
  if (left === 0) return { payments: 1, lastMonth: firstMonth, lastAmount: 0 };
  if (!(monthly > 0)) return null;
  const payments = Math.ceil(left / monthly);
  return { payments, lastMonth: addMonths(firstMonth, payments - 1), lastAmount: left - (payments - 1) * monthly };
}

/** What is planned per month for a debt: its category's monthly goal, else the minimum payment. */
export function plannedPayment(state: BudgetState, debt: Account): Cents | null {
  const goal = state.goals.find((g) => g.categoryId === debt.paymentCategoryId && g.type === 'monthly_amount');
  return goal?.monthlyAmount ?? debt.minimumPayment ?? null;
}

/** The month of the next payment: this month, unless a payment to the debt was already made this month. */
export function nextPaymentMonth(state: BudgetState, debt: Account, today: string): Month {
  const month = today.slice(0, 7);
  const paid = state.transactions.some((t) => t.transferAccountId === debt.id && t.amount < 0 && t.date.startsWith(month));
  return paid ? addMonths(month, 1) : month;
}

/** What is owed at the end of each month (positive), from the debt's first month up to `toMonth`. */
export function owedHistory(state: BudgetState, debt: Account, toMonth: Month): { month: Month; value: Cents }[] {
  const own = state.transactions.filter((t) => t.accountId === debt.id || t.transferAccountId === debt.id);
  if (own.length === 0) return [];
  const first = own.reduce((m, t) => (t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m), toMonth);
  const rows: { month: Month; value: Cents }[] = [];
  for (let m = first; m <= toMonth; m = addMonths(m, 1)) rows.push({ month: m, value: -accountBalance(state, debt.id, m) });
  return rows;
}
