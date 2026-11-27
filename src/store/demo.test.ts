import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/db.ts';
import { createBackup, parseBackup, serializeBackup } from '../db/backup.ts';
import { createBudgetStore } from './budgetStore.ts';

let n = 0;
const fresh = (name = `demo-test-${n++}`) => ({ name, store: createBudgetStore(createDb(name), '2026-01') });

test('starting the demo fills the app and marks it as sample data, also after a reload', async () => {
  const { name, store } = fresh();
  await store.getState().load();
  await store.getState().startDemo('de');
  assert.equal(store.getState().demo, true);
  assert.equal(store.getState().state.accounts[0]!.name, 'Girokonto');
  const again = createBudgetStore(createDb(name), '2026-01');
  await again.getState().load();
  assert.equal(again.getState().demo, true);
  assert.equal(again.getState().state.transactions.length, store.getState().state.transactions.length);
});

test('other setting changes keep the sample-data marker', async () => {
  const { store } = fresh();
  await store.getState().startDemo('en');
  await store.getState().setCurrency('USD');
  await store.getState().markBackedUp();
  assert.equal((await store.getState().readSaved()).demo, true);
});

test('clearing the data ends the demo', async () => {
  const { store } = fresh();
  await store.getState().startDemo('en');
  await store.getState().clearAllData();
  assert.equal(store.getState().demo, false);
  assert.equal(store.getState().state.accounts.length, 0);
  assert.equal((await store.getState().readSaved()).demo, false);
});

test('a backup of the demo comes back as the demo; a normal backup ends it', async () => {
  const { store } = fresh();
  await store.getState().startDemo('en');
  const { state, currency, demo } = await store.getState().readSaved();
  const demoBackup = parseBackup(serializeBackup(createBackup(state, currency, new Date(), demo)));
  const plainBackup = parseBackup(serializeBackup(createBackup(state, currency)));
  assert.ok(demoBackup.ok && plainBackup.ok);

  const other = fresh().store;
  await other.getState().importBackup(demoBackup.backup);
  assert.equal(other.getState().demo, true);
  await other.getState().importBackup(plainBackup.backup);
  assert.equal(other.getState().demo, false);
});

test('on the sample data each way of assigning does what it says', async () => {
  const { store } = fresh();
  await store.getState().startDemo('en');
  const { month } = store.getState();
  const { categoryAvailable } = await import('../engine/budget.ts');
  const { assignPlan } = await import('../engine/autoassign.ts');
  const active = () => store.getState().state.categories.filter((c) => !c.archived);
  for (const kind of ['goals', 'overspending', 'lastMonth'] as const) {
    await store.getState().autoAssign(kind);
    assert.equal(assignPlan(store.getState().state, month, kind).steps.length, 0, `${kind} left something to do`);
  }
  for (const c of active()) assert.ok(categoryAvailable(store.getState().state, c.id, month) >= 0, `${c.name} is still red`);
});
