import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountBalances, clearedStatus, isReconciled, keepCleared, reconcile, withCleared } from './reconcile.ts';
import { readyToAssign } from './budget.ts';
import type { BudgetState, Transaction } from './types.ts';

let n = 0;
const tx = (accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, accountId, date: '2026-11-10', payee: 'P', categoryId: amount < 0 ? 'food' : null, memo: '', amount, transferAccountId: null, ...extra,
});

const state = (transactions: Transaction[]): BudgetState => ({
  accounts: [
    { id: 'a', name: 'Checking', type: 'checking', openingBalance: 100000, sortOrder: 0, closed: false },
    { id: 'b', name: 'Savings', type: 'savings', openingBalance: 0, sortOrder: 1, closed: false },
  ],
  groups: [{ id: 'g', name: 'Living', sortOrder: 0, archived: false }],
  categories: [{ id: 'food', groupId: 'g', name: 'Groceries', sortOrder: 0, archived: false }],
  goals: [], recurring: [], monthlyBudgets: [], transactions,
});

test('a transfer has a separate status on each side', () => {
  const t = tx('a', -5000, { categoryId: null, transferAccountId: 'b' });
  const c = withCleared(t, 'b', 'cleared');
  assert.equal(clearedStatus(c, 'b'), 'cleared');
  assert.equal(clearedStatus(c, 'a'), 'uncleared');
  assert.throws(() => withCleared(t, 'zzz', 'cleared'));
});

test('cleared balance counts the opening balance and cleared or reconciled transactions only', () => {
  const s = state([
    tx('a', -2000, { cleared: 'cleared' }),
    tx('a', -3000, { cleared: 'reconciled' }),
    tx('a', -4000),
    tx('a', -5000, { categoryId: null, transferAccountId: 'b', cleared: 'uncleared', transferCleared: 'cleared' }),
  ]);
  assert.deepEqual(accountBalances(s, 'a'), { cleared: 95000, uncleared: -9000, working: 86000, clearedCount: 1 });
  assert.deepEqual(accountBalances(s, 'b'), { cleared: 5000, uncleared: 0, working: 5000, clearedCount: 1 });
});

test('reconciling with a matching statement locks in cleared transactions of that account only', () => {
  const s = state([
    tx('a', -2000, { cleared: 'cleared' }),
    tx('a', -4000),
    tx('b', 1000, { cleared: 'cleared' }),
    tx('a', -5000, { categoryId: null, transferAccountId: 'b', transferCleared: 'cleared' }),
  ]);
  const r = reconcile(s, 'a', 98000, { today: '2026-11-26', adjustmentId: 'adj', categoryId: null });
  assert.equal(r.adjustment, null);
  assert.equal(r.changed.length, 1);
  assert.deepEqual(r.state.transactions.map((t) => [t.cleared ?? '-', t.transferCleared ?? '-']), [
    ['reconciled', '-'], ['-', '-'], ['cleared', '-'], ['-', 'cleared'],
  ]);
  assert.equal(r.account.lastReconciled, '2026-11-26');
  assert.equal(r.state.accounts.find((a) => a.id === 'a')!.lastReconciled, '2026-11-26');
});

test('a difference is closed by a reconciled adjustment; lowering it needs a category', () => {
  const s = state([tx('a', -2000, { cleared: 'cleared' })]);
  assert.throws(() => reconcile(s, 'a', 97000, { today: '2026-11-26', adjustmentId: 'adj', categoryId: null }), /category/);

  const down = reconcile(s, 'a', 97000, { today: '2026-11-26', adjustmentId: 'adj', categoryId: 'food' });
  assert.equal(down.adjustment!.amount, -1000);
  assert.equal(down.adjustment!.categoryId, 'food');
  assert.equal(accountBalances(down.state, 'a').cleared, 97000);
  assert.ok(isReconciled(down.adjustment!));

  // A raise without a category is income, so it goes to Ready to Assign.
  const up = reconcile(s, 'a', 99000, { today: '2026-11-26', adjustmentId: 'adj', categoryId: null });
  assert.equal(up.adjustment!.amount, 1000);
  assert.equal(readyToAssign(up.state, '2026-11') - readyToAssign(s, '2026-11'), 1000);
});

test('an edit keeps the status per side while the account stays the same', () => {
  const original = tx('a', -5000, { categoryId: null, transferAccountId: 'b', cleared: 'reconciled', transferCleared: 'cleared' });
  assert.deepEqual(
    [keepCleared(original, { ...original, cleared: undefined, transferCleared: undefined, memo: 'x' })].map((t) => [t.cleared, t.transferCleared]),
    [['reconciled', 'cleared']],
  );
  const moved = keepCleared(original, { ...original, accountId: 'c' });
  assert.equal(moved.cleared, undefined);
  assert.equal(moved.transferCleared, 'cleared');
  const notTransfer = keepCleared(original, { ...original, transferAccountId: null, categoryId: 'food' });
  assert.equal(notTransfer.transferCleared, undefined);
  assert.equal(keepCleared(undefined, original).cleared, undefined);
  assert.ok(!('cleared' in keepCleared(undefined, original)));
});
