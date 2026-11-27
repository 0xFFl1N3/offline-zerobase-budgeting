import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/db.ts';
import { createBudgetStore } from './budgetStore.ts';
import { CHANGED_KEY, connectTabs, type Channel } from './tabSync.ts';

/** Two connected stand-ins for BroadcastChannel: a message from one reaches the other. */
function channelPair(): [Channel, Channel] {
  const a: Channel = { onmessage: null, postMessage: (m) => queueMicrotask(() => b.onmessage?.({ data: m })) };
  const b: Channel = { onmessage: null, postMessage: (m) => queueMicrotask(() => a.onmessage?.({ data: m })) };
  return [a, b];
}
const memoryStorage = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
};
const settle = () => new Promise((r) => setTimeout(r, 30));

test('a change in one tab shows up in the other and ends its Undo', async () => {
  const db = createDb('tabs-1');
  const tabA = createBudgetStore(db, '2026-01');
  const tabB = createBudgetStore(db, '2026-01');
  const [ca, cb] = channelPair();
  const storage = memoryStorage();
  connectTabs(tabA, { channel: ca, storage });
  connectTabs(tabB, { channel: cb, storage });

  await tabA.getState().load(); // as the app does on start
  await tabA.getState().completeSetup({ accountName: 'Checking', initialBalance: 1000, currency: 'EUR' });
  await tabB.getState().load();
  await tabB.getState().addGroup('Fun');
  await tabB.getState().deleteGroup(tabB.getState().state.groups[0]!.id);
  assert.equal(tabB.getState().undo?.kind, 'group');
  await settle();

  await tabA.getState().addGroup('Living');
  await settle();
  assert.deepEqual(tabB.getState().state.groups.map((g) => g.name), ['Living'], "tab B sees tab A's group");
  assert.equal(tabB.getState().undo, null, "tab B's Undo is out of date and gone");
  // Undo in B can no longer wipe A's group.
  await tabB.getState().undoDelete();
  assert.equal((await db.groups.toArray()).length, 1);
});

test('a tab coming back into view catches up on changes it missed', async () => {
  const db = createDb('tabs-2');
  const tabA = createBudgetStore(db, '2026-01');
  const tabB = createBudgetStore(db, '2026-01');
  const storage = memoryStorage();
  connectTabs(tabA, { channel: null, storage });
  const b = connectTabs(tabB, { channel: null, storage });
  await tabA.getState().load(); // as the app does on start
  await tabA.getState().completeSetup({ accountName: 'Checking', initialBalance: 1000, currency: 'EUR' });
  await tabB.getState().load();
  await tabA.getState().addGroup('Living');
  assert.ok(Number(storage.getItem(CHANGED_KEY)) > 0);
  assert.equal(tabB.getState().state.groups.length, 0, 'no message arrived');
  b.catchUp();
  await settle();
  assert.equal(tabB.getState().state.groups.length, 1);
});
