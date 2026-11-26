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

test('a category has one goal; saving replaces it and it survives reload', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 0, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addCategory(store.getState().state.groups[0]!.id, 'Rent');
  const rent = store.getState().state.categories[0]!;
  await store.getState().saveGoal({ id: 'g1', categoryId: rent.id, type: 'monthly_amount', monthlyAmount: 90000 });
  await store.getState().saveGoal({ id: 'g2', categoryId: rent.id, type: 'target_balance', targetAmount: 50000 });
  assert.deepEqual(store.getState().state.goals.map((g) => g.id), ['g2']);
  const again = createBudgetStore(db, '2026-01');
  await again.getState().load();
  assert.deepEqual(again.getState().state.goals.map((g) => g.id), ['g2']);
  await store.getState().removeGoal(rent.id);
  assert.equal(store.getState().state.goals.length, 0);
  await again.getState().load();
  await store.getState().load();
  assert.equal(store.getState().state.goals.length, 0);
});

test('rename, delete and archive persist across a reload', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addGroup('Fun');
  const living = store.getState().state.groups[0]!;
  const fun = store.getState().state.groups[1]!;
  await store.getState().addCategory(living.id, 'Rent');
  await store.getState().addCategory(living.id, 'Power');
  await store.getState().addCategory(fun.id, 'Games');
  const cat = (name: string) => store.getState().state.categories.find((c) => c.name === name)!;
  const rent = cat('Rent');
  const power = cat('Power');
  const games = cat('Games');
  await store.getState().assign(rent.id, 90000);
  await store.getState().assign(power.id, 4000);
  await store.getState().saveGoal({ id: 'g', categoryId: rent.id, type: 'monthly_amount', monthlyAmount: 90000 });
  await store.getState().saveTransaction({
    id: 't', accountId: store.getState().state.accounts[0]!.id, date: '2026-01-05', payee: 'L', categoryId: rent.id, memo: '', amount: -60000, transferAccountId: null,
  });

  await store.getState().renameGroup(living.id, '  Home ');
  await store.getState().renameCategory(rent.id, 'Rent & fees');
  await store.getState().renameCategory(rent.id, '   '); // ignored
  assert.equal(store.getState().state.groups[0]?.name, 'Home');

  // Rent has a transaction: it cannot be deleted, but it can be archived.
  await assert.rejects(store.getState().deleteCategory(rent.id), /Archive it instead/);
  await assert.rejects(store.getState().deleteGroup(living.id), /Archive it instead/);
  assert.equal(store.getState().state.categories.length, 3); // nothing was deleted
  assert.equal(readyToAssign(store.getState().state, '2026-01'), 6000); // 40000 - 30000 rent - 4000 power

  await store.getState().archiveCategory(rent.id);
  assert.equal(readyToAssign(store.getState().state, '2026-01'), 36000); // Rent's remaining 30000 is free again
  // Power has no transactions: it can be deleted.
  await store.getState().deleteCategory(power.id);
  assert.equal(readyToAssign(store.getState().state, '2026-01'), 40000);
  await store.getState().archiveGroup(fun.id);

  const again = createBudgetStore(db, '2026-01');
  await again.getState().load();
  let s = again.getState();
  assert.equal(s.state.categories.find((c) => c.id === rent.id)?.archived, true);
  assert.equal(s.state.categories.find((c) => c.id === games.id)?.archived, true);
  assert.equal(s.state.groups.find((g) => g.id === fun.id)?.archived, true);
  assert.equal(s.state.categories.some((c) => c.id === power.id), false);
  assert.equal(s.state.transactions[0]?.categoryId, rent.id); // history keeps its category
  assert.equal(readyToAssign(s.state, '2026-01'), 40000);

  await again.getState().restoreCategory(rent.id);
  await again.getState().restoreGroup(fun.id);
  const third = createBudgetStore(db, '2026-01');
  await third.getState().load();
  s = third.getState();
  assert.equal(s.state.categories.every((c) => !c.archived), true);
  assert.equal(s.state.groups.every((g) => !g.archived), true);
  assert.equal(readyToAssign(s.state, '2026-01'), 10000); // Rent's 30000 is counted again
});

test('editing, closing and deleting accounts persist across a reload', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addAccount('Cash', 'cash', 2000);
  await store.getState().addAccount('Old', 'savings', 0);
  const [, cash, old] = store.getState().state.accounts as [Account, Account, Account];
  await store.getState().editAccount(cash.id, { name: 'Wallet', openingBalance: 3000 });
  await store.getState().setAccountClosed(old.id, true);
  await assert.rejects(store.getState().setAccountClosed(cash.id, true), /remaining balance/);

  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  const byId = new Map(reloaded.getState().state.accounts.map((a) => [a.id, a]));
  assert.equal(byId.get(cash.id)!.name, 'Wallet');
  assert.equal(byId.get(cash.id)!.openingBalance, 3000);
  assert.equal(byId.get(old.id)!.closed, true);
  await reloaded.getState().deleteAccount(old.id);
  assert.equal(reloaded.getState().state.accounts.length, 2);
});

test('reordering persists across a reload', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 0, currency: 'EUR' });
  await store.getState().addAccount('Cash', 'cash', 0);
  await store.getState().addGroup('Living');
  await store.getState().addGroup('Fun');
  const living = store.getState().state.groups[0]!;
  const fun = store.getState().state.groups[1]!;
  await store.getState().addCategory(living.id, 'Rent');
  await store.getState().addCategory(living.id, 'Power');
  const power = store.getState().state.categories[1]!;
  const cash = store.getState().state.accounts[1]!;

  await store.getState().moveAccount(cash.id, -1);
  await store.getState().moveGroup(fun.id, -1);
  await store.getState().moveCategory(power.id, -1);

  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  const s = reloaded.getState().state;
  assert.deepEqual(s.accounts.map((a) => a.name), ['Cash', 'Checking']);
  assert.deepEqual(s.groups.map((g) => g.name), ['Fun', 'Living']);
  assert.deepEqual(s.categories.map((c) => c.name), ['Power', 'Rent']);
});

test('currency change and clearing all data persist across a reload', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 5000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().markBackedUp();

  await store.getState().setCurrency('USD');
  let reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  assert.equal(reloaded.getState().currency, 'USD');
  assert.equal(reloaded.getState().state.accounts.length, 1);

  await store.getState().clearAllData();
  assert.equal(store.getState().state.accounts.length, 0);
  assert.equal(store.getState().lastBackupAt, null);
  reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  assert.equal(reloaded.getState().state.accounts.length, 0);
  assert.equal(reloaded.getState().state.groups.length, 0);
  assert.equal(reloaded.getState().currency, 'USD');
  assert.equal(reloaded.getState().lastBackupAt, null);
});
