import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistenceStatus, requestPersistence, storageUsage } from './persistence.ts';

const manager = (persisted: boolean, grant: boolean) => {
  let asked = 0;
  let state = persisted;
  return {
    asked: () => asked,
    persisted: async () => state,
    persist: async () => {
      asked++;
      state = grant;
      return grant;
    },
    estimate: async () => ({ usage: 1234 }),
  };
};

test('asks only when not granted yet, and reports what the browser decided', async () => {
  const already = manager(true, true);
  assert.equal(await requestPersistence(already), 'granted');
  assert.equal(already.asked(), 0);

  const yes = manager(false, true);
  assert.equal(await persistenceStatus(yes), 'denied');
  assert.equal(await requestPersistence(yes), 'granted');
  assert.equal(yes.asked(), 1);

  assert.equal(await requestPersistence(manager(false, false)), 'denied');
  assert.equal(await requestPersistence({}), 'unsupported');
  assert.equal(await persistenceStatus(undefined), 'unsupported');
  assert.equal(await storageUsage(yes), 1234);
  assert.equal(await storageUsage({}), null);
});
