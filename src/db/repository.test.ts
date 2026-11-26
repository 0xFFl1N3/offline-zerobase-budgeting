import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './db.ts';
import {
  deleteGoal,
  loadAll,
  saveAccount,
  saveCategory,
  saveGoal,
  saveGroup,
  saveSettings,
  saveTransaction,
  setAssigned,
} from './repository.ts';

let n = 0;
const freshDb = () => createDb(`test-${n++}`);

test('loadAll on an empty database returns defaults', async () => {
  const { state, settings } = await loadAll(freshDb());
  assert.equal(state.accounts.length, 0);
  assert.equal(settings.currency, 'EUR');
});

test('saved records come back from loadAll', async () => {
  const db = freshDb();
  await saveAccount(db, { id: 'a', name: 'Checking', type: 'checking', openingBalance: 5000, closed: false });
  await saveGroup(db, { id: 'g2', name: 'Fun', sortOrder: 2, archived: false });
  await saveGroup(db, { id: 'g1', name: 'Living', sortOrder: 1, archived: false });
  await saveCategory(db, { id: 'c', groupId: 'g1', name: 'Rent', sortOrder: 0, archived: false });
  await saveGoal(db, { id: 'goal', categoryId: 'c', type: 'monthly_amount', monthlyAmount: 90000 });
  await saveTransaction(db, {
    id: 't', accountId: 'a', date: '2026-01-05', payee: 'X', categoryId: 'c', memo: '', amount: -100, transferAccountId: null,
  });
  await saveSettings(db, { currency: 'USD' });
  const { state, settings } = await loadAll(db);
  assert.equal(state.accounts[0]?.openingBalance, 5000);
  assert.deepEqual(state.groups.map((g) => g.id), ['g1', 'g2']); // sorted by sortOrder
  assert.equal(state.categories.length, 1);
  assert.equal(state.goals.length, 1);
  assert.equal(state.transactions.length, 1);
  assert.equal(settings.currency, 'USD');
  await deleteGoal(db, 'goal');
  assert.equal((await loadAll(db)).state.goals.length, 0);
});

test('setAssigned overwrites, and zero removes the row', async () => {
  const db = freshDb();
  await setAssigned(db, 'c', '2026-01', 1000);
  await setAssigned(db, 'c', '2026-01', 2500);
  await setAssigned(db, 'c', '2026-02', 700);
  let { state } = await loadAll(db);
  assert.equal(state.monthlyBudgets.length, 2);
  assert.equal(state.monthlyBudgets.find((b) => b.month === '2026-01')?.assigned, 2500);
  await setAssigned(db, 'c', '2026-01', 0);
  ({ state } = await loadAll(db));
  assert.equal(state.monthlyBudgets.length, 1);
});

test('old target_by_date goals load as target_balance', async () => {
  const db = freshDb();
  await db.goals.put({ id: 'old', categoryId: 'c', type: 'target_by_date' as never, targetAmount: 5000, targetDate: '2026-06' });
  const goal = (await loadAll(db)).state.goals[0];
  assert.equal(goal?.type, 'target_balance');
  assert.equal(goal?.targetDate, '2026-06');
});
