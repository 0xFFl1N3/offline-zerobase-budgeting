import { categoryParts } from './budget.ts';
import { addMonths, monthOf, monthsBetween } from './months.ts';
import type { BudgetState, Cents, Month } from './types.ts';

/** How far back the over-time reports look, ending at the selected month. */
export type RangeKey = '6' | '12' | '24' | 'all';

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '6', label: '6 months' },
  { key: '12', label: '12 months' },
  { key: '24', label: '24 months' },
  { key: 'all', label: 'All time' },
];

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

/** Income and spending per month. Transfers between accounts are neither. */
export function incomeVsSpending(state: BudgetState, months: Month[]): IncomeSpendingRow[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const rows: IncomeSpendingRow[] = months.map((month) => ({ month, income: 0, spending: 0, net: 0 }));
  for (const t of state.transactions) {
    if (t.transferAccountId !== null) continue;
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    const parts = categoryParts(t);
    if (parts.length === 0) {
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
