import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomeVsSpending, reportMonths } from './reports.ts';
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
