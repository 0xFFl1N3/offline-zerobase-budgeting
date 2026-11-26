import { test } from 'node:test';
import assert from 'node:assert/strict';
import { biggestCategory, incomeVsSpending, netWorth, reportMonths, spendingTrend, topPayees } from './reports.ts';
import type { BudgetState, Transaction } from './types.ts';

let n = 0;
const tx = (date: string, categoryId: string | null, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`,
  accountId: 'a',
  date,
  payee: '',
  categoryId,
  memo: '',
  amount,
  transferAccountId: null,
  ...extra,
});

const state = (transactions: Transaction[], extra: Partial<BudgetState> = {}): BudgetState => ({
  accounts: [
    { id: 'a', name: 'Checking', type: 'checking', openingBalance: 100000, sortOrder: 0, closed: false },
    { id: 'b', name: 'Savings', type: 'savings', openingBalance: 50000, sortOrder: 1, closed: false },
  ],
  groups: [
    { id: 'g1', name: 'Living', sortOrder: 0, archived: false },
    { id: 'g2', name: 'Fun', sortOrder: 1, archived: false },
  ],
  categories: [
    { id: 'rent', groupId: 'g1', name: 'Rent', sortOrder: 0, archived: false },
    { id: 'food', groupId: 'g1', name: 'Groceries', sortOrder: 1, archived: false },
    { id: 'games', groupId: 'g2', name: 'Games', sortOrder: 0, archived: false },
  ],
  goals: [],
  recurring: [],
  monthlyBudgets: [],
  transactions,
  ...extra,
});

test('fixed ranges end at the selected month, oldest first, across a year boundary', () => {
  const months = reportMonths(state([]), '6', '2026-03');
  assert.deepEqual(months, ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
  assert.equal(reportMonths(state([]), '24', '2026-03').length, 24);
});

test('"all time" starts at the first month with a transaction or assignment', () => {
  const s = state([tx('2026-02-10', 'rent', -1000)], { monthlyBudgets: [{ categoryId: 'rent', month: '2025-12', assigned: 1000 }] });
  assert.deepEqual(reportMonths(s, 'all', '2026-03'), ['2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(reportMonths(state([]), 'all', '2026-03'), ['2026-03']);
  // Data only after the selected month: just that month.
  assert.deepEqual(reportMonths(state([tx('2026-09-01', 'rent', -1)]), 'all', '2026-03'), ['2026-03']);
});

test('income is uncategorised inflow, spending is net categorised outflow, transfers count as neither', () => {
  const s = state([
    tx('2026-01-01', null, 300000), // salary
    tx('2026-01-02', 'rent', -90000),
    tx('2026-01-03', 'food', -20000),
    tx('2026-01-04', 'food', 5000), // refund
    tx('2026-01-05', null, -40000, { transferAccountId: 'b' }),
    tx('2026-01-06', null, -1234), // legacy outflow without category
    tx('2026-02-01', null, -10000, { splits: [{ categoryId: 'rent', amount: -6000 }, { categoryId: 'games', amount: -4000 }] }),
    tx('2025-12-31', null, 999999), // outside the range
  ]);
  assert.deepEqual(incomeVsSpending(s, ['2026-01', '2026-02']), [
    { month: '2026-01', income: 300000, spending: 105000, net: 195000 },
    { month: '2026-02', income: 0, spending: 10000, net: -10000 },
  ]);
});

test('net worth is opening balances plus everything up to each month end; transfers cancel out', () => {
  const s = state([
    tx('2025-11-15', null, 10000), // before the range: carried in
    tx('2026-01-05', 'rent', -90000),
    tx('2026-01-06', null, -30000, { transferAccountId: 'b' }),
    tx('2026-03-01', null, 200000),
    tx('2026-05-01', null, 1), // after the range
  ]);
  assert.deepEqual(netWorth(s, ['2026-01', '2026-02', '2026-03']), [
    { month: '2026-01', value: 150000 + 10000 - 90000 },
    { month: '2026-02', value: 70000 },
    { month: '2026-03', value: 270000 },
  ]);
});

test('spending trend for a category or a whole group, counting split parts and refunds', () => {
  const s = state([
    tx('2026-01-02', 'rent', -90000),
    tx('2026-01-03', 'food', -20000),
    tx('2026-02-03', 'food', -25000),
    tx('2026-02-04', 'food', 5000),
    tx('2026-02-05', null, -10000, { splits: [{ categoryId: 'food', amount: -6000 }, { categoryId: 'games', amount: -4000 }] }),
  ]);
  const months = ['2026-01', '2026-02'];
  assert.deepEqual(spendingTrend(s, months, { kind: 'category', id: 'food' }).map((r) => r.value), [20000, 26000]);
  assert.deepEqual(spendingTrend(s, months, { kind: 'group', id: 'g1' }).map((r) => r.value), [110000, 26000]);
  assert.deepEqual(spendingTrend(s, months, { kind: 'group', id: 'g2' }).map((r) => r.value), [0, 4000]);
  assert.equal(biggestCategory(s, months), 'rent');
  assert.equal(biggestCategory(s, ['2026-02']), 'food');
  assert.equal(biggestCategory(s, ['2025-01']), undefined);
});

test('top payees: merged ignoring case and spaces, latest spelling, refunds net, income and transfers ignored', () => {
  const s = state([
    tx('2026-01-02', 'food', -2000, { payee: 'REWE ' }),
    tx('2026-01-20', 'food', -3000, { payee: 'Rewe' }),
    tx('2026-01-21', 'food', 500, { payee: 'rewe' }), // refund; the latest spelling wins
    tx('2026-01-05', 'rent', -90000, { payee: 'Landlord' }),
    tx('2026-01-06', 'games', -1000, { payee: '' }),
    tx('2026-01-07', null, 300000, { payee: 'Employer' }),
    tx('2026-01-08', null, -5000, { payee: 'Savings', transferAccountId: 'b' }),
    tx('2026-01-09', 'games', -4000, { payee: 'Steam' }),
    tx('2026-01-10', 'games', 4000, { payee: 'Steam' }), // fully refunded: left out
    tx('2026-03-01', 'rent', -1, { payee: 'Elsewhere' }), // outside the range
  ]);
  const r = topPayees(s, ['2026-01', '2026-02']);
  assert.deepEqual(r.rows, [
    { label: 'Landlord', amount: 90000, count: 1 },
    { label: 'rewe', amount: 4500, count: 3 },
    { label: '(no payee)', amount: 1000, count: 1 },
  ]);
  assert.equal(r.total, 95500);
  assert.equal(r.others, 0);
  const top1 = topPayees(s, ['2026-01'], 1);
  assert.equal(top1.rows.length, 1);
  assert.equal(top1.others, 2);
  assert.equal(top1.total, 95500);
});
