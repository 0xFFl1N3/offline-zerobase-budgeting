import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageHistory, ageOfMoney, outflowAges } from './ageOfMoney.ts';
import type { BudgetState, Transaction } from './types.ts';

const tx = (date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `${date}${amount}${Math.random()}`,
  accountId: 'a',
  date,
  payee: '',
  categoryId: amount < 0 ? 'c' : null,
  memo: '',
  amount,
  transferAccountId: null,
  ...extra,
});

const state = (transactions: Transaction[], openingBalance = 0): BudgetState => ({
  accounts: [
    { id: 'a', name: 'A', type: 'checking', openingBalance, sortOrder: 0, closed: false },
    { id: 'b', name: 'B', type: 'savings', openingBalance: 0, sortOrder: 1, closed: false },
  ],
  groups: [],
  categories: [],
  goals: [],
  monthlyBudgets: [],
  transactions,
  recurring: [],
});

test('spends the oldest money first, weighted by amount', () => {
  const s = state([tx('2026-01-01', 10000), tx('2026-01-31', 10000), tx('2026-02-10', -15000)]);
  // 100 from Jan 1 (40 days) + 50 from Jan 31 (10 days) = (100·40 + 50·10) / 150 = 30
  assert.deepEqual(outflowAges(s, '2026-12-31'), [30]);
});

test('opening balance counts from the first transaction; overspending counts as 0 days; transfers are ignored', () => {
  const s = state(
    [
      tx('2026-03-01', -1000),
      tx('2026-03-11', -5000, { transferAccountId: 'b' }),
      tx('2026-03-21', -2000),
      tx('2026-03-21', -2000),
    ],
    3000,
  );
  assert.deepEqual(outflowAges(s, '2026-12-31'), [0, 20, 0]);
});

test('needs ten outflows, averages the last ten, ignores later dates', () => {
  const list = [tx('2026-01-01', 1_000_000)];
  for (let d = 1; d <= 11; d++) list.push(tx(`2026-02-${String(d).padStart(2, '0')}`, -100));
  const s = state(list);
  assert.equal(ageOfMoney(s, '2026-02-09'), null);
  // ages 31..41; the last ten are 32..41, average 36.5 → 37
  assert.equal(ageOfMoney(s, '2026-12-31'), 37);
  assert.equal(ageOfMoney(s, '2026-02-10'), 36);
});

test('money received and spent the same day is 0 days old', () => {
  assert.deepEqual(outflowAges(state([tx('2026-05-05', -500), tx('2026-05-05', 500)]), '2026-12-31'), [0]);
});

test('history gives the value at each month end, null before ten outflows', () => {
  const list = [tx('2026-01-01', 1_000_000)];
  for (let d = 1; d <= 12; d++) list.push(tx(`2026-02-${String(d).padStart(2, '0')}`, -100), tx(`2026-03-${String(d).padStart(2, '0')}`, -100));
  const s = state(list);
  // Feb: ages 31..42, last ten 33..42 → 37.5 → 38. Mar: ages 59..70, last ten 61..70 → 65.5 → 66.
  assert.deepEqual(ageHistory(s, ['2026-01', '2026-02', '2026-03'], '2026-03-20'), [
    { month: '2026-01', value: null },
    { month: '2026-02', value: 38 },
    { month: '2026-03', value: 66 },
  ]);
});
