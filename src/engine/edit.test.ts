import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountBalance, readyToAssign } from './budget.ts';
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

test('deleting a category returns its balance to Ready to Assign and keeps its transactions', () => {
  const before = state();
  assert.equal(readyToAssign(before, '2026-01'), 8000); // 40000 in accounts - 30000 rent - 2000 games
  const after = removeCategories(before, ['rent']);
  assert.equal(after.categories.length, 2);
  assert.equal(after.goals.length, 1);
  assert.equal(after.monthlyBudgets.length, 1);
  assert.equal(after.transactions.length, 1);
  assert.equal(after.transactions[0]?.categoryId, null);
  assert.equal(accountBalance(after, 'a'), 40000); // unchanged
  assert.equal(readyToAssign(after, '2026-01'), 38000); // +30000, the deleted category's balance
});

test('deleting a group removes its categories, goals and assignments', () => {
  const after = removeGroup(state(), 'g1');
  assert.deepEqual(after.groups.map((g) => g.id), ['g2']);
  assert.deepEqual(after.categories.map((c) => c.id), ['games']);
  assert.deepEqual(after.goals.map((g) => g.id), ['goal2']);
  assert.equal(after.monthlyBudgets.length, 1);
  assert.equal(after.transactions[0]?.categoryId, null);
});
