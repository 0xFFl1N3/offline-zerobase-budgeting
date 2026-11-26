import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsWithData, spendingReport } from './analytics.ts';
import type { BudgetState, Transaction } from './types.ts';

const tx = (date: string, categoryId: string | null, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `${date}-${categoryId}-${amount}-${Math.random()}`,
  accountId: 'a',
  date,
  payee: '',
  categoryId,
  memo: '',
  amount,
  transferAccountId: null,
  ...extra,
});

const base = (transactions: Transaction[], monthlyBudgets: BudgetState['monthlyBudgets'] = []): BudgetState => ({
  accounts: [
    { id: 'a', name: 'Checking', type: 'checking', openingBalance: 0, sortOrder: 0, closed: false },
    { id: 'b', name: 'Savings', type: 'savings', openingBalance: 0, sortOrder: 0, closed: false },
  ],
  groups: [
    { id: 'g1', name: 'Living', sortOrder: 0, archived: false },
    { id: 'g2', name: 'Fun', sortOrder: 1, archived: false },
  ],
  categories: [
    { id: 'rent', groupId: 'g1', name: 'Rent', sortOrder: 0, archived: false },
    { id: 'power', groupId: 'g1', name: 'Electricity', sortOrder: 1, archived: false },
    { id: 'games', groupId: 'g2', name: 'Games', sortOrder: 0, archived: false },
  ],
  goals: [],
  recurring: [],
  monthlyBudgets,
  transactions,
});

test('month report: net spending per category, excluding income, transfers and other months', () => {
  const s = base([
    tx('2026-03-01', 'rent', -90000),
    tx('2026-03-10', 'games', -6000),
    tx('2026-03-11', 'games', 1000), // refund
    tx('2026-03-12', null, 200000), // income
    tx('2026-03-13', null, -5000, { transferAccountId: 'b' }), // transfer
    tx('2026-02-20', 'rent', -90000), // other month
  ]);
  const r = spendingReport(s, 'month', '2026-03', 'category');
  assert.deepEqual(r.slices.map((x) => [x.label, x.amount]), [['Rent', 90000], ['Games', 5000]]);
  assert.equal(r.total, 95000);
  assert.equal(r.slices[0]?.percent, 94.7);
  assert.equal(r.uncategorizedCount, 0);
});

test('year to date covers January through the selected month of that year only', () => {
  const s = base([
    tx('2025-12-01', 'rent', -111111), // previous year
    tx('2026-01-05', 'rent', -90000),
    tx('2026-03-05', 'rent', -90000),
    tx('2026-04-05', 'rent', -90000), // after the selected month
  ]);
  const r = spendingReport(s, 'year-to-date', '2026-03', 'category');
  assert.equal(r.fromMonth, '2026-01');
  assert.equal(r.total, 180000);
});

test('monthly average divides by months that have any data', () => {
  const s = base(
    [
      tx('2026-01-05', 'rent', -60000),
      tx('2026-02-05', null, 100000), // income only: the month has data
      // March: no data at all
      tx('2026-04-05', 'rent', -30000),
    ],
    [{ categoryId: 'rent', month: '2026-05', assigned: 1000 }], // May has data through an assignment only
  );
  assert.deepEqual(monthsWithData(s, '2026-01', '2026-05'), ['2026-01', '2026-02', '2026-04', '2026-05']);
  const r = spendingReport(s, 'monthly-average', '2026-05', 'category');
  assert.equal(r.divisor, 4);
  assert.equal(r.total, 22500); // 90000 / 4
  // A selected month without data is not counted.
  const r2 = spendingReport(s, 'monthly-average', '2026-03', 'category');
  assert.equal(r2.divisor, 2);
  assert.equal(r2.total, 30000); // 60000 / 2
});

test('monthly average with no data at all is empty', () => {
  const r = spendingReport(base([]), 'monthly-average', '2026-03', 'category');
  assert.equal(r.divisor, 0);
  assert.equal(r.total, 0);
  assert.deepEqual(r.slices, []);
});

test('grouping by group adds up the categories in it', () => {
  const s = base([tx('2026-03-01', 'rent', -90000), tx('2026-03-02', 'power', -10000), tx('2026-03-03', 'games', -5000)]);
  const r = spendingReport(s, 'month', '2026-03', 'group');
  assert.deepEqual(r.slices.map((x) => [x.label, x.amount]), [['Living', 100000], ['Fun', 5000]]);
});

test('categories with net refunds are not spending', () => {
  const s = base([tx('2026-03-01', 'games', -1000), tx('2026-03-02', 'games', 3000), tx('2026-03-03', 'rent', -500)]);
  const r = spendingReport(s, 'month', '2026-03', 'category');
  assert.deepEqual(r.slices.map((x) => x.label), ['Rent']);
});

test('slices under 3% are combined into Other, but only when there are at least two', () => {
  const many = base([tx('2026-03-01', 'rent', -100000), tx('2026-03-02', 'power', -1000), tx('2026-03-03', 'games', -1500)]);
  const r = spendingReport(many, 'month', '2026-03', 'category');
  assert.deepEqual(r.slices.map((x) => [x.label, x.amount, x.isOther]), [['Rent', 100000, false], ['Other', 2500, true]]);

  const one = base([tx('2026-03-01', 'rent', -100000), tx('2026-03-02', 'power', -1000)]);
  const r2 = spendingReport(one, 'month', '2026-03', 'category');
  assert.deepEqual(r2.slices.map((x) => x.label), ['Rent', 'Electricity']); // a lone small slice stays itself
});

test('legacy uncategorized outflows are counted but not charted', () => {
  const s = base([tx('2026-03-01', null, -2000), tx('2026-03-02', 'rent', -1000)]);
  const r = spendingReport(s, 'month', '2026-03', 'category');
  assert.equal(r.uncategorizedCount, 1);
  assert.equal(r.total, 1000);
});

test('at most 8 named slices; the rest fold into Other even when they are large', () => {
  const categories = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, groupId: 'g1', name: `Cat ${i}`, sortOrder: i, archived: false }));
  // 10 categories of almost equal size: none is under 3%, but only 8 can be named.
  const s = { ...base(categories.map((c, i) => tx('2026-03-01', c.id, -(10000 - i)))), categories };
  const r = spendingReport(s, 'month', '2026-03', 'category');
  assert.equal(r.slices.length, 9);
  assert.equal(r.slices.filter((x) => !x.isOther).length, 8);
  const other = r.slices.at(-1)!;
  assert.equal(other.isOther, true);
  assert.equal(other.amount, 9992 + 9991); // the two smallest
  assert.equal(r.slices.reduce((t, x) => t + x.amount, 0), r.total);
});
