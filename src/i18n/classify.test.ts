import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/db.ts';
import { RuleError } from '../engine/ruleError.ts';
import { createBudgetStore } from '../store/budgetStore.ts';
import { classify, isReported } from './errors.ts';

test('sorts errors into rule, storage and unexpected', () => {
  assert.equal(classify(new RuleError('An account needs a name.')).kind, 'rule');
  const quota = Object.assign(new Error('Transaction aborted'), { name: 'AbortError', inner: Object.assign(new Error('full'), { name: 'QuotaExceededError' }) });
  assert.deepEqual([classify(quota).kind, classify(quota).message], ['storage', 'error.storageFull']);
  assert.equal(classify(Object.assign(new Error('x'), { name: 'DatabaseClosedError' })).reload, true);
  assert.equal(classify(new TypeError('undefined is not a function')).kind, 'unexpected');
});

test('a failed save shows in the store and still fails for the caller; rule errors are left to the caller', async () => {
  const db = createDb('classify-store');
  const store = createBudgetStore(db, '2026-01');
  await store.getState().completeSetup({ accountName: 'Checking', initialBalance: 1000, currency: 'EUR' });

  await assert.rejects(store.getState().editAccount(store.getState().state.accounts[0]!.id, { name: ' ' }), RuleError);
  assert.equal(store.getState().problem, null);

  db.close();
  const failed = await store.getState().addGroup('Living').then(() => null, (e: unknown) => e);
  assert.ok(failed, 'the save failed');
  assert.ok(isReported(failed));
  assert.equal(store.getState().problem?.kind, 'storage');
  assert.equal(store.getState().state.groups.length, 0, 'nothing unsaved is shown');
  store.getState().dismissProblem();
  assert.equal(store.getState().problem, null);
});
