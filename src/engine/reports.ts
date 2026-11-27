import { categoryParts } from './budget.ts';
import { addMonths, monthOf, monthsBetween } from './months.ts';
import type { BudgetState, Cents, Month } from './types.ts';

/** How far back the over-time reports look, ending at the selected month. */
export type RangeKey = '6' | '12' | '24' | 'all';

/** In switch order; their names are in the translations (range.6 … range.all). */
export const RANGES: { key: RangeKey }[] = [{ key: '6' }, { key: '12' }, { key: '24' }, { key: 'all' }];

/** The earliest month with a transaction or an assignment. */
export function firstMonthWithData(state: BudgetState): Month | undefined {
  let first: Month | undefined;
  for (const t of state.transactions) {
    const m = monthOf(t.date);
    if (first === undefined || m < first) first = m;
  }
  for (const b of state.monthlyBudgets) if (first === undefined || b.month < first) first = b.month;
  return first;
}

/** Every month of the range, oldest first, ending at `toMonth`. "All time" starts at the first month with data. */
export function reportMonths(state: BudgetState, range: RangeKey, toMonth: Month): Month[] {
  let from: Month;
  if (range === 'all') {
    const first = firstMonthWithData(state);
    from = first !== undefined && first < toMonth ? first : toMonth;
  } else {
    from = addMonths(toMonth, -(Number(range) - 1));
  }
  return Array.from({ length: monthsBetween(from, toMonth) + 1 }, (_, i) => addMonths(from, i));
}

export interface IncomeSpendingRow {
  month: Month;
  /** Inflows without a category (money that went to Ready to Assign). */
  income: Cents;
  /** Categorised outflows, net of refunds booked to a category. */
  spending: Cents;
  /** income − spending: what was saved (positive) or drawn down (negative). */
  net: Cents;
}

/** Income and spending per month. Transfers between accounts are neither, except debt payments, which are spending. */
export function incomeVsSpending(state: BudgetState, months: Month[]): IncomeSpendingRow[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const rows: IncomeSpendingRow[] = months.map((month) => ({ month, income: 0, spending: 0, net: 0 }));
  for (const t of state.transactions) {
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    const parts = categoryParts(t);
    if (parts.length === 0) {
      if (t.transferAccountId !== null) continue;
      if (t.amount > 0) rows[i]!.income += t.amount; // an outflow without a category is legacy data and not counted
      continue;
    }
    for (const part of parts) rows[i]!.spending -= part.amount;
  }
  for (const row of rows) row.net = row.income - row.spending;
  return rows;
}

export interface MonthValue {
  month: Month;
  value: Cents;
}

/**
 * Net worth at the end of each month: the sum of all account balances (closed accounts included, they are at zero).
 * Opening balances count from the start, and transfers between accounts cancel out.
 */
export function netWorth(state: BudgetState, months: Month[]): MonthValue[] {
  if (months.length === 0) return [];
  let running = state.accounts.reduce((t, a) => t + a.openingBalance, 0);
  const byMonth = new Map<Month, Cents>();
  for (const t of state.transactions) {
    if (t.transferAccountId !== null) continue;
    const m = monthOf(t.date);
    if (m < months[0]!) running += t.amount;
    else byMonth.set(m, (byMonth.get(m) ?? 0) + t.amount);
  }
  return months.map((month) => {
    running += byMonth.get(month) ?? 0;
    return { month, value: running };
  });
}

export interface TrendTarget {
  kind: 'category' | 'group';
  id: string;
}

/** Spending per month for one category, or for all categories of one group (archived ones included). Refunds lower it. */
export function spendingTrend(state: BudgetState, months: Month[], target: TrendTarget): MonthValue[] {
  const ids = new Set(target.kind === 'category' ? [target.id] : state.categories.filter((c) => c.groupId === target.id).map((c) => c.id));
  const index = new Map(months.map((m, i) => [m, i]));
  const rows: MonthValue[] = months.map((month) => ({ month, value: 0 }));
  for (const t of state.transactions) {
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    for (const part of categoryParts(t)) if (ids.has(part.categoryId)) rows[i]!.value -= part.amount;
  }
  return rows;
}

/** The category with the most spending in the months, to show first. */
export function biggestCategory(state: BudgetState, months: Month[]): string | undefined {
  const index = new Set(months);
  const spent = new Map<string, Cents>();
  for (const t of state.transactions) {
    if (!index.has(monthOf(t.date))) continue;
    for (const part of categoryParts(t)) spent.set(part.categoryId, (spent.get(part.categoryId) ?? 0) - part.amount);
  }
  let best: string | undefined;
  for (const [id, amount] of spent) if (amount > 0 && (best === undefined || amount > spent.get(best)!)) best = id;
  return best;
}

export interface PayeeRow {
  label: string;
  amount: Cents;
  /** Transactions with this payee in the period. */
  count: number;
}

export interface TopPayees {
  rows: PayeeRow[];
  /** Spending of all payees in the period, listed or not. */
  total: Cents;
  /** Payees with spending that did not make the list. */
  others: number;
}

export const NO_PAYEE = '(no payee)';

/**
 * Where the money went: spending per payee in the months, largest first. Payees match ignoring case and spaces
 * at the ends, and show the most recent spelling. Refunds from the same payee lower its amount; transfers and income don't count.
 */
export function topPayees(state: BudgetState, months: Month[], limit = 10): TopPayees {
  const inRange = new Set(months);
  const byKey = new Map<string, PayeeRow & { latest: string }>();
  for (const t of state.transactions) {
    if (!inRange.has(monthOf(t.date))) continue;
    const parts = categoryParts(t);
    if (parts.length === 0) continue;
    const name = t.payee.trim();
    const key = name.toLowerCase();
    const row = byKey.get(key) ?? { label: name || NO_PAYEE, amount: 0, count: 0, latest: '' };
    for (const part of parts) row.amount -= part.amount;
    row.count++;
    if (t.date >= row.latest) {
      row.latest = t.date;
      row.label = name || NO_PAYEE;
    }
    byKey.set(key, row);
  }
  const all = [...byKey.values()]
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
    .map(({ label, amount, count }) => ({ label, amount, count }));
  return { rows: all.slice(0, limit), total: all.reduce((t, r) => t + r.amount, 0), others: Math.max(0, all.length - limit) };
}
