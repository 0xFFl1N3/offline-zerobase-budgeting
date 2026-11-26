import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spendingReport } from './analytics.ts';
import { categoryActivity, categoryAvailable, readyToAssign, touchesCategory } from './budget.ts';
import { removeCategories, setCategoryArchived } from './edit.ts';
import type { BudgetState } from './types.ts';

const M = '2026-01';
const state = (): BudgetState => ({
  accounts: [{ id: 'a', name: 'Checking', type: 'checking', openingBalance: 100000, sortOrder: 0, closed: false }],
  groups: [{ id: 'g', name: 'Living', sortOrder: 0, archived: false }],
  categories: [
    { id: 'food', groupId: 'g', name: 'Groceries', sortOrder: 0, archived: false },
    { id: 'home', groupId: 'g', name: 'Household', sortOrder: 1, archived: false },
  ],
  goals: [],
  monthlyBudgets: [
    { categoryId: 'food', month: M, assigned: 20000 },
    { categoryId: 'home', month: M, assigned: 10000 },
  ],
  transactions: [
    {
      id: 's', accountId: 'a', date: '2026-01-10', payee: 'Supermarket', categoryId: null, memo: '', amount: -5000, transferAccountId: null,
      splits: [{ categoryId: 'food', amount: -3000 }, { categoryId: 'home', amount: -2000 }],
    },
  ],
});

test('each part of a split hits its own category', () => {
  const s = state();
  assert.equal(categoryActivity(s, 'food', M), -3000);
  assert.equal(categoryActivity(s, 'home', M), -2000);
  assert.equal(categoryAvailable(s, 'food', M), 17000);
  assert.equal(categoryAvailable(s, 'home', M), 8000);
});

test('Ready to Assign counts the whole account balance minus the category balances', () => {
  const s = state();
  assert.equal(readyToAssign(s, M), 95000 - 25000); // 100000 - 5000 account, minus 17000 + 8000
});

test('archiving a category with a split part frees only that part’s balance', () => {
  const s = setCategoryArchived(state(), 'home', true);
  assert.equal(readyToAssign(s, M), 95000 - 17000);
});

test('a category used in a split cannot be deleted', () => {
  assert.equal(touchesCategory(state().transactions[0]!, ['home']), true);
  assert.throws(() => removeCategories(state(), ['home']), /Archive it instead/);
});

test('analytics counts each part under its category', () => {
  const report = spendingReport(state(), 'month', M, 'category');
  assert.equal(report.total, 5000);
  assert.deepEqual(report.slices.map((x) => [x.label, x.amount]).sort(), [['Groceries', 3000], ['Household', 2000]]);
  assert.equal(report.uncategorizedCount, 0);
});
