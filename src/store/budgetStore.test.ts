import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/db.ts';
import { accountBalance, categoryAvailable, readyToAssign } from '../engine/budget.ts';
import type { Account } from '../engine/types.ts';
import { createBudgetStore } from './budgetStore.ts';

let n = 0;
const fresh = () => {
  const db = createDb(`store-test-${n++}`);
  return { db, store: createBudgetStore(db, '2026-01') };
};

test('setup creates the first account and the full amount is unassigned', async () => {
  const { store } = fresh();
  await store.getState().load();
  assert.equal(store.getState().state.accounts.length, 0);
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'USD' });
  const s = store.getState();
  assert.equal(s.currency, 'USD');
  assert.equal(readyToAssign(s.state, s.month), 100000);
});

test('groups, categories and assigning update Ready to Assign', async () => {
  const { store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  const group = store.getState().state.groups[0]!;
  await store.getState().addCategory(group.id, 'Rent');
  const rent = store.getState().state.categories[0]!;
  await store.getState().assign(rent.id, 90000);
  let s = store.getState();
  assert.equal(readyToAssign(s.state, s.month), 10000);
  assert.equal(categoryAvailable(s.state, rent.id, s.month), 90000);
  await store.getState().assign(rent.id, 0);
  s = store.getState();
  assert.equal(readyToAssign(s.state, s.month), 100000);
});

test('assigned amounts are per month and rolled over', async () => {
  const { store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addCategory(store.getState().state.groups[0]!.id, 'Rent');
  const rent = store.getState().state.categories[0]!;
  await store.getState().assign(rent.id, 40000);
  store.getState().shiftMonth(1);
  assert.equal(store.getState().month, '2026-02');
  await store.getState().assign(rent.id, 10000);
  const s = store.getState();
  assert.equal(categoryAvailable(s.state, rent.id, '2026-02'), 50000);
  assert.equal(categoryAvailable(s.state, rent.id, '2026-01'), 40000);
});

test('data survives a reload from the database', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 5000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addAccount('Cash', 'cash', 2000);
  const again = createBudgetStore(db, '2026-01');
  await again.getState().load();
  assert.equal(again.getState().state.accounts.length, 2);
  assert.equal(again.getState().state.groups[0]?.name, 'Living');
});

test('blank names are ignored', async () => {
  const { store } = fresh();
  await store.getState().addGroup('   ');
  assert.equal(store.getState().state.groups.length, 0);
});

test('transactions move account and category balances, and can be edited and removed', async () => {
  const { store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addAccount('Savings', 'savings', 0);
  await store.getState().addGroup('Living');
  await store.getState().addCategory(store.getState().state.groups[0]!.id, 'Rent');
  const [chk, sav] = store.getState().state.accounts as [Account, Account];
  const rent = store.getState().state.categories[0]!;
  await store.getState().assign(rent.id, 90000);

  const base = { accountId: chk.id, date: '2026-01-05', payee: 'Landlord', memo: '', transferAccountId: null };
  await store.getState().saveTransaction({ ...base, id: 't1', categoryId: rent.id, amount: -60000 });
  let s = store.getState();
  assert.equal(accountBalance(s.state, chk.id), 40000);
  assert.equal(categoryAvailable(s.state, rent.id, s.month), 30000);
  assert.equal(readyToAssign(s.state, s.month), 10000);

  await store.getState().saveTransaction({ ...base, id: 't1', categoryId: rent.id, amount: -90000 }); // edit
  s = store.getState();
  assert.equal(s.state.transactions.length, 1);
  assert.equal(categoryAvailable(s.state, rent.id, s.month), 0);

  await store.getState().saveTransaction({ ...base, id: 't2', categoryId: null, amount: -10000, transferAccountId: sav.id });
  s = store.getState();
  assert.equal(accountBalance(s.state, sav.id), 10000);
  assert.equal(readyToAssign(s.state, s.month), 10000);

  await store.getState().removeTransaction('t1');
  await store.getState().removeTransaction('t2');
  s = store.getState();
  assert.equal(readyToAssign(s.state, s.month), 10000);
  assert.equal(accountBalance(s.state, chk.id), 100000);
});
