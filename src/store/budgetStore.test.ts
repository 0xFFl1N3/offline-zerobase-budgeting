import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/db.ts';
import { accountBalance, categoryAvailable, readyToAssign } from '../engine/budget.ts';
import type { Account, Category, Transaction } from '../engine/types.ts';
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

test('auto-assign funds goals once and persists', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 200000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  const group = store.getState().state.groups[0]!;
  await store.getState().addCategory(group.id, 'Rent');
  await store.getState().addCategory(group.id, 'Fun');
  const [rent, fun] = store.getState().state.categories as unknown as [Category, Category];
  await store.getState().saveGoal({ id: 'g1', categoryId: rent.id, type: 'monthly_amount', monthlyAmount: 90000 });
  await store.getState().saveGoal({ id: 'g2', categoryId: fun.id, type: 'target_balance', targetAmount: 3000 });

  assert.equal(await store.getState().autoAssign(), 2);
  assert.equal(await store.getState().autoAssign(), 0);
  const s = store.getState();
  assert.equal(readyToAssign(s.state, s.month), 200000 - 93000);

  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  assert.equal(categoryAvailable(reloaded.getState().state, rent.id, '2026-01'), 90000);
});

test('recurring series persist: start, confirm, skip, edit, pause and delete', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  const account = store.getState().state.accounts[0]!;
  const tx = (date: string): Transaction => ({ id: 'first', accountId: account.id, date, payee: 'Gym', categoryId: null, memo: '', amount: -2500, transferAccountId: null });

  // A past date is booked at once; the series then waits for the next occurrence.
  await store.getState().startRecurringSeries(tx('2020-01-15'), 'monthly', null);
  let s = store.getState().state;
  assert.equal(s.transactions.length, 1);
  const id = s.recurring[0]!.id;
  assert.equal(s.recurring[0]!.handled, 1);

  await store.getState().confirmRecurring(id, 3000);
  await store.getState().skipRecurring(id);
  s = store.getState().state;
  assert.deepEqual(s.transactions.map((t) => [t.date, t.amount]), [['2020-01-15', -2500], ['2020-02-15', -3000]]);
  assert.equal(s.recurring[0]!.handled, 3);

  await store.getState().editRecurring(id, { payee: 'Gym Plus', frequency: 'yearly' });
  await store.getState().pauseRecurring(id, true);

  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  const r = reloaded.getState().state.recurring[0]!;
  assert.deepEqual([r.template.payee, r.frequency, r.paused, r.startDate, r.handled], ['Gym Plus', 'yearly', true, '2020-04-15', 0]);
  assert.equal(reloaded.getState().state.transactions.length, 2);

  await reloaded.getState().makeRecurring('first', 'weekly', null);
  assert.equal(reloaded.getState().state.recurring.length, 2);
  await reloaded.getState().deleteRecurring(id);
  const again = createBudgetStore(db, '2026-01');
  await again.getState().load();
  assert.equal(again.getState().state.recurring.length, 1);
  assert.equal(again.getState().state.transactions.length, 2); // booked transactions stay
});

test('clearing and reconciling persist across a reload', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addCategory(store.getState().state.groups[0]!.id, 'Food');
  const chk = store.getState().state.accounts[0]!;
  const food = store.getState().state.categories[0]!;
  const base = { accountId: chk.id, date: '2026-01-05', payee: 'Shop', memo: '', transferAccountId: null, categoryId: food.id };
  await store.getState().saveTransaction({ ...base, id: 't1', amount: -2000 });
  await store.getState().saveTransaction({ ...base, id: 't2', amount: -3000 });
  await store.getState().setCleared('t1', chk.id, 'cleared');

  // The bank shows 97,000 but only 98,000 is cleared: a 1,000 adjustment in Food closes the gap.
  await store.getState().reconcileAccount(chk.id, 97000, food.id);

  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  const s = reloaded.getState().state;
  assert.equal(s.transactions.find((t) => t.id === 't1')!.cleared, 'reconciled');
  assert.equal(s.transactions.find((t) => t.id === 't2')!.cleared, undefined);
  const adj = s.transactions.find((t) => t.payee === 'Reconciliation adjustment')!;
  assert.equal(adj.amount, -1000);
  assert.equal(adj.categoryId, food.id);
  assert.equal(adj.cleared, 'reconciled');
  assert.match(s.accounts[0]!.lastReconciled!, /^\d{4}-\d{2}-\d{2}$/);
});

test('an import can add new transactions and replace an updated pending one in one go', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Giro', initialBalance: 0, currency: 'EUR' });
  const acc = store.getState().state.accounts[0]!.id;
  const base = { accountId: acc, payee: 'Shop', memo: '', transferAccountId: null, categoryId: null };
  await store.getState().importTransactions([{ ...base, id: 'p', date: '2026-01-05', amount: 100, importId: 'csv2:a', importPending: true }]);
  await store.getState().importTransactions([
    { ...base, id: 'p', date: '2026-01-06', amount: 100, importId: 'csv2:b', cleared: 'cleared' },
    { ...base, id: 'n', date: '2026-01-07', amount: 200, importId: 'csv2:c', cleared: 'cleared' },
  ]);
  assert.equal(store.getState().state.transactions.length, 2);
  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  const p = reloaded.getState().state.transactions.find((t) => t.id === 'p')!;
  assert.deepEqual([p.date, p.cleared, p.importPending, p.importId], ['2026-01-06', 'cleared', undefined, 'csv2:b']);
});

test('closing an account or archiving a category pauses the series that use it, and that persists', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 0, currency: 'EUR' });
  await store.getState().addAccount('Old', 'savings', 0);
  await store.getState().addGroup('Fun');
  await store.getState().addCategory(store.getState().state.groups[0]!.id, 'Streaming');
  const [chk, old] = store.getState().state.accounts as [Account, Account];
  const cat = store.getState().state.categories[0]!;
  const base = { payee: 'Netflix', memo: '', transferAccountId: null, amount: -1399 };
  await store.getState().startRecurringSeries({ ...base, id: 'n1', accountId: chk.id, categoryId: cat.id, date: '2099-01-01' }, 'monthly', null);
  await store.getState().startRecurringSeries({ ...base, id: 'n2', accountId: old.id, categoryId: cat.id, date: '2099-01-01', payee: 'Gym' }, 'monthly', null);

  await store.getState().setAccountClosed(old.id, true);
  let rec = store.getState().state.recurring;
  assert.deepEqual(rec.map((r) => [r.template.payee, r.paused]).sort(), [['Gym', true], ['Netflix', false]]);

  await store.getState().archiveCategory(cat.id);
  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  rec = reloaded.getState().state.recurring;
  assert.deepEqual(rec.map((r) => [r.template.payee, r.paused]).sort(), [['Gym', true], ['Netflix', true]]);
  assert.equal(reloaded.getState().state.accounts.find((a) => a.id === old.id)!.closed, true);
});

test('undo brings back the latest delete, in memory and in the database', async () => {
  const { db, store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addCategory(store.getState().state.groups[0]!.id, 'Rent');
  const account = store.getState().state.accounts[0]!;
  const rent = store.getState().state.categories[0]!;
  const tx: Transaction = { id: 't1', accountId: account.id, date: '2026-01-05', payee: 'Landlord', categoryId: rent.id, memo: '', amount: -50000, transferAccountId: null };
  await store.getState().saveTransaction(tx);

  await store.getState().removeTransaction('t1');
  assert.equal(store.getState().undo?.kind, 'transaction');
  assert.equal(store.getState().state.transactions.length, 0);
  await store.getState().undoDelete();
  assert.equal(store.getState().undo, null);
  assert.deepEqual(store.getState().state.transactions, [tx]);

  // Undo also reaches the database: a reload sees the restored data.
  await store.getState().addAccount('Cash', 'cash', 0);
  const cash = store.getState().state.accounts.find((a) => a.name === 'Cash')!;
  await store.getState().deleteAccount(cash.id);
  assert.equal(store.getState().state.accounts.length, 1);
  await store.getState().undoDelete();
  const reloaded = createBudgetStore(db, '2026-01');
  await reloaded.getState().load();
  assert.deepEqual(reloaded.getState().state.accounts.map((a) => a.name).sort(), ['Cash', 'Checking']);
  assert.equal(reloaded.getState().state.transactions.length, 1);
});

test('any other change ends the chance to undo', async () => {
  const { store } = fresh();
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 100000, currency: 'EUR' });
  await store.getState().addGroup('Living');
  await store.getState().addGroup('Fun');
  await store.getState().deleteGroup(store.getState().state.groups[1]!.id);
  assert.equal(store.getState().undo?.kind, 'group');
  store.getState().shiftMonth(1); // not a budget change
  assert.equal(store.getState().undo?.kind, 'group');
  await store.getState().addGroup('Travel');
  assert.equal(store.getState().undo, null);
  await store.getState().undoDelete(); // nothing to undo
  assert.deepEqual(store.getState().state.groups.map((g) => g.name).sort(), ['Living', 'Travel']);
});
