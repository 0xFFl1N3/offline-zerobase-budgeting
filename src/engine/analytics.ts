import { monthOf } from './months.ts';
import type { BudgetState, Cents, Month } from './types.ts';

export type ReportKind = 'month' | 'year-to-date' | 'monthly-average';
export type GroupBy = 'category' | 'group';

export interface Slice {
  id: string;
  label: string;
  amount: Cents;
  /** Share of the total, 0 to 100, one decimal. */
  percent: number;
  /** True for the combined "Other" slice. */
  isOther: boolean;
}

export interface SpendingReport {
  kind: ReportKind;
  fromMonth: Month;
  toMonth: Month;
  /** Months the amounts are divided by: 1 for a single month, months with data for the average. */
  divisor: number;
  total: Cents;
  slices: Slice[];
  /** Outflows in the period that have no category (legacy data). They are not part of the report. */
  uncategorizedCount: number;
}

/** Slices below this share of the total are combined into "Other" (when there are at least two). */
export const OTHER_THRESHOLD = 0.03;

const percentOf = (amount: Cents, total: Cents) => (total > 0 ? Math.round((amount / total) * 1000) / 10 : 0);

/** Months in [from, to] that have at least one transaction or assignment. */
export function monthsWithData(state: BudgetState, from: Month, to: Month): Month[] {
  const months = new Set<Month>();
  for (const t of state.transactions) months.add(monthOf(t.date));
  for (const b of state.monthlyBudgets) months.add(b.month);
  return [...months].filter((m) => m >= from && m <= to).sort();
}

/**
 * Spending per category or group for the period ending at `month`.
 * Spending = outflows with a category, net of refunds booked to the same category; transfers and income are excluded.
 */
export function spendingReport(state: BudgetState, kind: ReportKind, month: Month, groupBy: GroupBy): SpendingReport {
  const fromMonth: Month = kind === 'month' ? month : `${month.slice(0, 4)}-01`;
  const spentByCategory = new Map<string, Cents>();
  let uncategorizedCount = 0;

  for (const t of state.transactions) {
    const m = monthOf(t.date);
    if (m < fromMonth || m > month || t.transferAccountId !== null) continue;
    if (t.categoryId === null) {
      if (t.amount < 0) uncategorizedCount++;
      continue;
    }
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) - t.amount);
  }

  const divisor = kind === 'monthly-average' ? monthsWithData(state, fromMonth, month).length : 1;

  // Roll categories up to the chosen level.
  const rolled = new Map<string, { label: string; amount: Cents }>();
  for (const [categoryId, spent] of spentByCategory) {
    if (spent <= 0) continue; // net refunds are not spending
    const category = state.categories.find((c) => c.id === categoryId);
    if (!category) continue;
    const group = state.groups.find((g) => g.id === category.groupId);
    const key = groupBy === 'group' ? category.groupId : category.id;
    const label = groupBy === 'group' ? (group?.name ?? 'Unknown group') : category.name;
    const entry = rolled.get(key) ?? { label, amount: 0 };
    entry.amount += spent;
    rolled.set(key, entry);
  }

  let items = [...rolled.entries()].map(([id, e]) => ({ id, label: e.label, amount: divisor > 0 ? Math.round(e.amount / divisor) : 0 }));
  items = items.filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
  const total = items.reduce((t, i) => t + i.amount, 0);

  const small = items.filter((i) => i.amount / total < OTHER_THRESHOLD);
  const combine = small.length >= 2;
  const kept = combine ? items.filter((i) => !small.includes(i)) : items;
  const slices: Slice[] = kept.map((i) => ({ ...i, percent: percentOf(i.amount, total), isOther: false }));
  if (combine) {
    const amount = small.reduce((t, i) => t + i.amount, 0);
    slices.push({ id: 'other', label: 'Other', amount, percent: percentOf(amount, total), isOther: true });
  }

  return { kind, fromMonth, toMonth: month, divisor, total, slices, uncategorizedCount };
}
