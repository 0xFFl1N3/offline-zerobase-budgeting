import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupStatus } from './backupStatus.ts';

const now = new Date('2026-03-15T12:00:00Z');

test('never backed up warns only when there is data', () => {
  assert.deepEqual(backupStatus(null, true, now), { warn: true, text: 'Never backed up' });
  assert.equal(backupStatus(null, false, now).warn, false);
});

test('recent backups do not warn', () => {
  assert.deepEqual(backupStatus('2026-03-15T08:00:00Z', true, now), { warn: false, text: 'Backed up today' });
  assert.deepEqual(backupStatus('2026-03-14T08:00:00Z', true, now), { warn: false, text: 'Last backup 1 day ago' });
});

test('old backups warn after 14 days', () => {
  assert.equal(backupStatus('2026-03-02T12:00:00Z', true, now).warn, false); // 13 days
  assert.deepEqual(backupStatus('2026-03-01T12:00:00Z', true, now), { warn: true, text: 'Last backup 14 days ago' });
});
