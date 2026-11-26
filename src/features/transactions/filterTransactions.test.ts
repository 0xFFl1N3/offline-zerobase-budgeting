import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BudgetState, Transaction } from '../../engine/types.ts';
import { filterTransactions, hasActiveFilters, NO_FILTERS } from './filterTransactions.ts';

const tx = (id: string, p: Partial<Transaction>): Transaction => ({
  id, accountId: 'a', date: '2026-01-10', payee: '', categoryId: null, memo: '', amount: -1000, transferAccountId: null, ...p,
});

const state: BudgetState = {
  accounts: [
    { id: 'a', name: 'Checking', type: 'checking', openingBalance: 0, sortOrder: 0, closed: false },
    { id: 'b', name: 'Savings', type: 'savings', openingBalance: 0, sortOrder: 1, closed: false },
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
  monthlyBudgets: [],
  transactions: [
    tx('t1', { date: '2026-01-05', payee: 'Landlord', categoryId: 'rent', amount: -90000 }),
    tx('t2', { date: '2026-02-03', payee: 'Utility Co', categoryId: 'power', memo: 'January bill' }),
    tx('t3', { date: '2026-02-20', payee: 'Steam', categoryId: 'games', accountId: 'b' }),
    tx('t4', { date: '2026-02-25', payee: 'Employer', amount: 300000 }),
    tx('t5', { date: '2026-03-01', payee: 'Move', amount: -5000, transferAccountId: 'b' }),
    tx('t6', { date: '2026-03-02', payee: 'Old', amount: -700 }),
  ],
};

const ids = (f: Partial<typeof NO_FILTERS>) => filterTransactions(state, { ...NO_FILTERS, ...f }).map((t) => t.id);

test('no filters returns everything, newest first', () => {
  assert.deepEqual(ids({}), ['t6', 't5', 't4', 't3', 't2', 't1']);
  assert.equal(hasActiveFilters(NO_FILTERS), false);
  assert.equal(hasActiveFilters({ ...NO_FILTERS, search: ' x ' }), true);
});

test('account filter includes transfers on either side', () => {
  assert.deepEqual(ids({ accountId: 'b' }), ['t5', 't3']);
});

test('category, group, income, transfer and uncategorised filters', () => {
  assert.deepEqual(ids({ category: 'cat:rent' }), ['t1']);
  assert.deepEqual(ids({ category: 'group:g1' }), ['t2', 't1']);
  assert.deepEqual(ids({ category: 'income' }), ['t4']);
  assert.deepEqual(ids({ category: 'transfers' }), ['t5']);
  assert.deepEqual(ids({ category: 'uncategorised' }), ['t6']);
});

test('date range is inclusive and open-ended on either side', () => {
  assert.deepEqual(ids({ from: '2026-02-01', to: '2026-02-28' }), ['t4', 't3', 't2']);
  assert.deepEqual(ids({ from: '2026-02-25' }), ['t6', 't5', 't4']);
  assert.deepEqual(ids({ to: '2026-01-05' }), ['t1']);
});

test('search matches payee, memo and category name; filters combine', () => {
  assert.deepEqual(ids({ search: 'JANUARY' }), ['t2']);
  assert.deepEqual(ids({ search: 'electric' }), ['t2']);
  assert.deepEqual(ids({ search: 'steam', accountId: 'a' }), []);
  assert.deepEqual(ids({ category: 'group:g1', from: '2026-02-01' }), ['t2']);
});

test('a split transaction matches the filters of each of its categories', () => {
  const withSplit: BudgetState = {
    ...state,
    transactions: [tx('sp', { date: '2026-03-03', payee: 'Mall', amount: -1000, splits: [{ categoryId: 'rent', amount: -600 }, { categoryId: 'games', amount: -400 }] }), ...state.transactions],
  };
  const run = (f: Partial<typeof NO_FILTERS>) => filterTransactions(withSplit, { ...NO_FILTERS, ...f }).map((t) => t.id);
  assert.deepEqual(run({ category: 'cat:games' }), ['sp', 't3']);
  assert.deepEqual(run({ category: 'group:g2' }), ['sp', 't3']);
  assert.deepEqual(run({ category: 'cat:power' }), ['t2']);
  assert.equal(run({ category: 'uncategorised' }).includes('sp'), false);
  assert.equal(run({ category: 'income' }).includes('sp'), false);
  assert.deepEqual(run({ search: 'electricity' }), ['t2']);
  assert.deepEqual(run({ search: 'games' }), ['sp', 't3']);
});
