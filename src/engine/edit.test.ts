import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountBalance, categoryAvailable, readyToAssign } from './budget.ts';
import { removeCategories, removeGroup } from './edit.ts';
import type { BudgetState } from './types.ts';

const state = (): BudgetState => ({
  accounts: [{ id: 'a', name: 'Checking', type: 'checking', openingBalance: 100000, closed: false }],
  groups: [
    { id: 'g1', name: 'Living', sortOrder: 0, archived: false },
    { id: 'g2', name: 'Fun', sortOrder: 1, archived: false },
  ],
  categories: [
    { id: 'rent', groupId: 'g1', name: 'Rent', sortOrder: 0, archived: false },
    { id: 'power', groupId: 'g1', name: 'Electricity', sortOrder: 1, archived: false },
    { id: 'games', groupId: 'g2', name: 'Games', sortOrder: 0, archived: false },
  ],
  goals: [
    { id: 'goal1', categoryId: 'rent', type: 'monthly_amount', monthlyAmount: 90000 },
    { id: 'goal2', categoryId: 'games', type: 'target_balance', targetAmount: 5000 },
  ],
  monthlyBudgets: [
    { categoryId: 'rent', month: '2026-01', assigned: 90000 },
    { categoryId: 'games', month: '2026-01', assigned: 2000 },
  ],
  transactions: [
    { id: 't1', accountId: 'a', date: '2026-01-05', payee: 'L', categoryId: 'rent', memo: '', amount: -60000, transferAccountId: null },
  ],
});

test('deleting a category moves its transactions and returns its assigned money to Ready to Assign', () => {
  const before = state();
  assert.equal(readyToAssign(before, '2026-01'), 8000); // 40000 in accounts - 30000 rent - 2000 games
  const after = removeCategories(before, ['rent'], 'games');
  assert.equal(after.categories.length, 2);
  assert.equal(after.goals.length, 1);
  assert.equal(after.monthlyBudgets.length, 1);
  assert.equal(after.transactions[0]?.categoryId, 'games');
  assert.equal(accountBalance(after, 'a'), 40000); // unchanged
  assert.equal(categoryAvailable(after, 'games', '2026-01'), -58000); // 2000 assigned - 60000 moved spending
  assert.equal(readyToAssign(after, '2026-01'), 98000); // +90000, the deleted category's assigned money
});

test('a category without transactions can be deleted without a target', () => {
  const after = removeCategories(state(), ['power']);
  assert.equal(after.categories.some((c) => c.id === 'power'), false);
  assert.equal(readyToAssign(after, '2026-01'), 8000);
});

test('spending must be moved: deleting without a target is refused', () => {
  assert.throws(() => removeCategories(state(), ['rent']), /moved to another category/);
});

test('inflows alone may be left without a category (they become income)', () => {
  const s = state();
  s.transactions = [{ id: 'r', accountId: 'a', date: '2026-01-05', payee: 'Refund', categoryId: 'rent', memo: '', amount: 500, transferAccountId: null }];
  const after = removeCategories(s, ['rent']);
  assert.equal(after.transactions[0]?.categoryId, null);
});

test('the target must exist and must not be deleted itself', () => {
  assert.throws(() => removeCategories(state(), ['rent'], 'rent'), /being deleted/);
  assert.throws(() => removeCategories(state(), ['rent'], 'nope'), /does not exist/);
});

test('deleting a group removes its categories and moves their transactions', () => {
  const after = removeGroup(state(), 'g1', 'games');
  assert.deepEqual(after.groups.map((g) => g.id), ['g2']);
  assert.deepEqual(after.categories.map((c) => c.id), ['games']);
  assert.deepEqual(after.goals.map((g) => g.id), ['goal2']);
  assert.equal(after.monthlyBudgets.length, 1);
  assert.equal(after.transactions[0]?.categoryId, 'games');
  assert.throws(() => removeGroup(state(), 'g1', 'power'), /being deleted/);
});
