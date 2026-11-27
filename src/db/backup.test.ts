import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BudgetState } from '../engine/types.ts';
import { createBudgetStore } from '../store/budgetStore.ts';
import { createBackup, parseBackup, serializeBackup } from './backup.ts';
import { createDb } from './db.ts';
import { loadAll } from './repository.ts';

const sample = (): BudgetState => ({
  accounts: [
    { id: 'a', name: 'Checking', type: 'checking', openingBalance: 100000, sortOrder: 0, closed: false },
    { id: 'b', name: 'Savings', type: 'savings', openingBalance: 0, sortOrder: 0, closed: false },
  ],
  groups: [{ id: 'g', name: 'Living', sortOrder: 0, archived: false }],
  categories: [{ id: 'c', groupId: 'g', name: 'Rent', sortOrder: 0, archived: false }],
  goals: [
    { id: 'g1', categoryId: 'c', type: 'target_balance', targetAmount: 50000, targetDate: '2026-12' },
  ],
  monthlyBudgets: [{ categoryId: 'c', month: '2026-01', assigned: 90000 }],
  recurring: [],
  transactions: [
    { id: 't1', accountId: 'a', date: '2026-01-05', payee: 'Landlord', categoryId: 'c', memo: '', amount: -60000, transferAccountId: null },
    { id: 't2', accountId: 'a', date: '2026-01-06', payee: 'Transfer', categoryId: null, memo: 'x', amount: -1000, transferAccountId: 'b' },
  ],
});

const text = (mutate?: (o: any) => void) => {
  const o = JSON.parse(serializeBackup(createBackup(sample(), 'USD', new Date('2026-02-01T10:00:00Z'))));
  mutate?.(o);
  return JSON.stringify(o);
};

test('a backup round-trips exactly', () => {
  const r = parseBackup(text());
  assert.ok(r.ok);
  assert.deepEqual(r.backup.data, sample());
  assert.equal(r.backup.settings.currency, 'USD');
  assert.equal(r.backup.exportedAt, '2026-02-01T10:00:00.000Z');
});

test('invalid files are rejected with a message', () => {
  const bad: Array<[string, string]> = [
    ['not json', '{nope'],
    ['wrong app', text((o) => (o.app = 'other'))],
    ['newer version', text((o) => (o.version = 99))],
    ['missing list', text((o) => delete o.data.transactions)],
    ['fractional cents', text((o) => (o.data.transactions[0].amount = 1.5))],
    ['bad date', text((o) => (o.data.transactions[0].date = 'yesterday'))],
    ['missing account ref', text((o) => (o.data.transactions[0].accountId = 'zzz'))],
    ['missing category ref', text((o) => (o.data.monthlyBudgets[0].categoryId = 'zzz'))],
    ['duplicate ids', text((o) => o.data.accounts.push({ ...o.data.accounts[0] }))],
    ['unknown account type', text((o) => (o.data.accounts[0].type = 'crypto'))],
    ['two assignments for one category and month', text((o) => o.data.monthlyBudgets.push({ ...o.data.monthlyBudgets[0], assigned: 1 }))],
  ];
  for (const [name, content] of bad) {
    const r = parseBackup(content);
    assert.equal(r.ok, false, name);
    if (!r.ok) assert.ok(r.error.length > 0, name);
  }
});

test('legacy target_by_date goals are read as target_balance', () => {
  const r = parseBackup(text((o) => (o.data.goals[0].type = 'target_by_date')));
  assert.ok(r.ok);
  assert.equal(r.backup.data.goals[0]?.type, 'target_balance');
});

test('importing replaces all data, persists, and keeps the backup timestamp', async () => {
  const db = createDb('backup-import-test');
  const store = createBudgetStore(db, '2026-01');
  await store.getState().completeSetup({ accountName: 'Old', initialBalance: 1, currency: 'EUR' });
  await store.getState().markBackedUp();
  const stamp = store.getState().lastBackupAt;
  assert.ok(stamp);

  const parsed = parseBackup(text());
  assert.ok(parsed.ok);
  await store.getState().importBackup(parsed.backup);
  assert.deepEqual(store.getState().state, sample());
  assert.equal(store.getState().currency, 'USD');

  const { state, settings } = await loadAll(db);
  assert.equal(state.accounts.length, 2); // 'Old' account is gone
  assert.equal(state.transactions.length, 2);
  assert.equal(settings.currency, 'USD');
  assert.equal(settings.lastBackupAt, stamp);
});

test('split transactions round-trip and are validated', () => {
  const split = (mutate?: (t: any) => void) =>
    text((o) => {
      o.data.categories.push({ id: 'c2', groupId: 'g', name: 'Food', sortOrder: 1, archived: false });
      const t = { id: 't3', accountId: 'a', date: '2026-01-07', payee: 'Shop', categoryId: null, memo: '', amount: -5000, transferAccountId: null,
        splits: [{ categoryId: 'c', amount: -3000 }, { categoryId: 'c2', amount: -2000 }] };
      mutate?.(t);
      o.data.transactions.push(t);
    });
  const ok = parseBackup(split());
  assert.ok(ok.ok);
  assert.equal(ok.backup.data.transactions.find((t) => t.id === 't3')!.splits!.length, 2);
  const err = (r: ReturnType<typeof parseBackup>) => (r.ok ? '' : r.error);
  assert.match(err(parseBackup(split((t) => (t.splits[1].amount = -1)))), /add up/);
  assert.match(err(parseBackup(split((t) => (t.splits = [t.splits[0]])))), /at least two/);
  assert.match(err(parseBackup(split((t) => (t.splits[0].categoryId = 'nope')))), /missing category/);
  assert.match(err(parseBackup(split((t) => (t.categoryId = 'c')))), /cannot also have a category/);
});

test('recurring series round-trip, old backups without them load, and bad ones are rejected', () => {
  const rec = () => ({
    id: 'r1', frequency: 'monthly', startDate: '2026-01-31', handled: 1, endDate: null, paused: false,
    template: { accountId: 'a', payee: 'Landlord', categoryId: 'c', memo: '', amount: -60000, transferAccountId: null },
  });
  const withRec = (mutate?: (r: any) => void) => text((o) => { const r = rec(); mutate?.(r); o.data.recurring = [r]; });
  const ok = parseBackup(withRec());
  assert.ok(ok.ok);
  assert.deepEqual(ok.backup.data.recurring, [rec()]);

  const old = parseBackup(text((o) => { delete o.data.recurring; }));
  assert.ok(old.ok);
  assert.deepEqual(old.backup.data.recurring, []);

  const err = (r: ReturnType<typeof parseBackup>) => (r.ok ? '' : r.error);
  assert.match(err(parseBackup(withRec((r) => (r.frequency = 'daily')))), /frequency/);
  assert.match(err(parseBackup(withRec((r) => (r.startDate = 'soon')))), /startDate/);
  assert.match(err(parseBackup(withRec((r) => (r.handled = -1)))), /negative/);
  assert.match(err(parseBackup(withRec((r) => (r.template.accountId = 'nope')))), /missing account/);
  assert.match(err(parseBackup(withRec((r) => (r.template.categoryId = 'nope')))), /missing category/);
});

test('cleared statuses and the last reconciliation date round-trip; old backups have none; bad values are rejected', () => {
  const marked = (mutate?: (o: any) => void) =>
    text((o) => {
      o.data.accounts[0].lastReconciled = '2026-01-31';
      o.data.transactions[0].cleared = 'reconciled';
      o.data.transactions[1].cleared = 'cleared';
      o.data.transactions[1].transferCleared = 'uncleared';
      mutate?.(o);
    });
  const ok = parseBackup(marked());
  assert.ok(ok.ok);
  assert.equal(ok.backup.data.accounts[0]!.lastReconciled, '2026-01-31');
  assert.deepEqual(ok.backup.data.transactions.map((t) => [t.cleared, t.transferCleared]), [['reconciled', undefined], ['cleared', 'uncleared']]);
  const old = parseBackup(text());
  assert.ok(old.ok && !('cleared' in old.backup.data.transactions[0]!) && !('lastReconciled' in old.backup.data.accounts[0]!));

  const err = (r: ReturnType<typeof parseBackup>) => (r.ok ? '' : r.error);
  assert.match(err(parseBackup(marked((o) => (o.data.transactions[0].cleared = 'maybe')))), /unknown cleared status/);
  assert.match(err(parseBackup(marked((o) => (o.data.transactions[0].transferCleared = 'cleared')))), /only a transfer/);
  assert.match(err(parseBackup(marked((o) => (o.data.accounts[0].lastReconciled = 'yesterday')))), /lastReconciled/);
});

test('import ids round-trip and old backups have none', () => {
  const r = parseBackup(text((o) => (o.data.transactions[0].importId = 'csv:abc')));
  assert.ok(r.ok);
  assert.equal(r.backup.data.transactions[0]!.importId, 'csv:abc');
  assert.equal(r.backup.data.transactions[1]!.importId, undefined);
  const bad = parseBackup(text((o) => (o.data.transactions[0].importId = 5)));
  assert.ok(!bad.ok);
});
