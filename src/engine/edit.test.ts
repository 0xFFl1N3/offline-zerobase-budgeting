import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spendingReport } from './analytics.ts';
import { accountBalance, readyToAssign } from './budget.ts';
import { removeAccount, removeCategories, removeGroup, setAccountClosed, setCategoryArchived, setGroupArchived, updateAccount } from './edit.ts';
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
    { categoryId: 'power', month: '2026-01', assigned: 4000 },
    { categoryId: 'games', month: '2026-01', assigned: 2000 },
  ],
  transactions: [
    { id: 't1', accountId: 'a', date: '2026-01-05', payee: 'L', categoryId: 'rent', memo: '', amount: -60000, transferAccountId: null },
  ],
});
const M = '2026-01';

test('a category without transactions can be deleted; its assigned money returns to Ready to Assign', () => {
  const before = state();
  assert.equal(readyToAssign(before, M), 4000); // 40000 - 30000 rent - 4000 power - 2000 games
  const after = removeCategories(before, ['power']);
  assert.equal(after.categories.some((c) => c.id === 'power'), false);
  assert.equal(after.monthlyBudgets.some((b) => b.categoryId === 'power'), false);
  assert.equal(readyToAssign(after, M), 8000);
});

test('a category with transactions cannot be deleted', () => {
  assert.throws(() => removeCategories(state(), ['rent']), /Archive it instead/);
});

test('deleting a group removes its categories, goals and assignments', () => {
  const s = state();
  s.transactions = [];
  const after = removeGroup(s, 'g1');
  assert.deepEqual(after.groups.map((g) => g.id), ['g2']);
  assert.deepEqual(after.categories.map((c) => c.id), ['games']);
  assert.deepEqual(after.goals.map((g) => g.id), ['goal2']);
  assert.equal(after.monthlyBudgets.length, 1);
  assert.throws(() => removeGroup(state(), 'g1'), /Archive it instead/); // Rent has a transaction
});

test('archiving returns the category\'s remaining balance to Ready to Assign and keeps history', () => {
  const before = state();
  const after = setCategoryArchived(before, 'rent', true);
  assert.equal(after.categories.find((c) => c.id === 'rent')?.archived, true);
  assert.equal(accountBalance(after, 'a'), 40000); // unchanged
  assert.equal(readyToAssign(after, M), 4000 + 30000); // Rent's remaining 30000 is free again
  assert.equal(after.transactions.length, 1); // the payment keeps its category
  assert.equal(after.transactions[0]?.categoryId, 'rent');
  // Past spending still shows in analytics.
  assert.equal(spendingReport(after, 'month', M, 'category').slices[0]?.label, 'Rent');
});

test('restoring brings the balance back and restores the group', () => {
  const archivedGroup = setGroupArchived(state(), 'g1', true);
  assert.equal(archivedGroup.categories.filter((c) => c.archived).length, 2);
  assert.equal(readyToAssign(archivedGroup, M), 4000 + 30000 + 4000);
  const restoredCategory = setCategoryArchived(archivedGroup, 'rent', false);
  assert.equal(restoredCategory.groups.find((g) => g.id === 'g1')?.archived, false);
  assert.equal(restoredCategory.categories.find((c) => c.id === 'rent')?.archived, false);
  assert.equal(readyToAssign(restoredCategory, M), 4000 + 4000); // Rent is counted again, Electricity still archived
  const all = setGroupArchived(archivedGroup, 'g1', false);
  assert.equal(readyToAssign(all, M), 4000);
});

test('archiving an overspent category takes the shortfall from Ready to Assign', () => {
  const s = state();
  s.transactions.push({ id: 't2', accountId: 'a', date: M + '-06', payee: 'X', categoryId: 'games', memo: '', amount: -5000, transferAccountId: null });
  // games: 2000 assigned - 5000 spent = -3000
  const before = readyToAssign(s, M);
  assert.equal(readyToAssign(setCategoryArchived(s, 'games', true), M), before - 3000);
});

const twoAccounts = (): BudgetState => {
  const s = state();
  s.accounts.push({ id: 'b', name: 'Savings', type: 'savings', openingBalance: 5000, closed: false });
  return s;
};

test('renaming an account and fixing its opening balance changes Ready to Assign', () => {
  const before = twoAccounts();
  const after = updateAccount(before, 'b', { name: '  Piggy bank ', openingBalance: 8000, type: 'cash' });
  const b = after.accounts.find((a) => a.id === 'b')!;
  assert.deepEqual([b.name, b.type, b.openingBalance], ['Piggy bank', 'cash', 8000]);
  assert.equal(readyToAssign(after, M) - readyToAssign(before, M), 3000);
  assert.throws(() => updateAccount(before, 'b', { name: ' ' }), /needs a name/);
  assert.throws(() => updateAccount(before, 'zzz', { name: 'x' }), /Unknown account/);
});

test('an account can only be closed with a zero balance, and reopened', () => {
  const s = twoAccounts();
  assert.throws(() => setAccountClosed(s, 'b', true), /remaining balance/);
  const emptied = updateAccount(s, 'b', { openingBalance: 0 });
  const closed = setAccountClosed(emptied, 'b', true);
  assert.equal(closed.accounts.find((a) => a.id === 'b')!.closed, true);
  assert.equal(setAccountClosed(closed, 'b', false).accounts.find((a) => a.id === 'b')!.closed, false);
  assert.equal(readyToAssign(closed, M), readyToAssign(emptied, M));
});

test('an account is deleted only when nothing refers to it', () => {
  const s = twoAccounts();
  assert.equal(removeAccount(s, 'b').accounts.length, 1);
  assert.throws(() => removeAccount(s, 'a'), /Close it instead/);
  s.transactions.push({ id: 't2', accountId: 'a', date: '2026-01-06', payee: '', categoryId: null, memo: '', amount: -1000, transferAccountId: 'b' });
  assert.throws(() => removeAccount(s, 'b'), /Close it instead/);
});
