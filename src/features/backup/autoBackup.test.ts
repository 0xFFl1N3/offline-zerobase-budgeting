import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupsToRemove, isBackupDue, writeBackup, type FolderHandle } from './autoBackup.ts';

test('a backup is due after a day, or when there was none', () => {
  assert.equal(isBackupDue(null, '2026-11-26'), true);
  assert.equal(isBackupDue('2026-11-26', '2026-11-26'), false);
  assert.equal(isBackupDue('2026-11-25', '2026-11-26'), true);
  assert.equal(isBackupDue('2026-11-25', '2026-11-26', 3), false);
});

test('keeps the newest backups and never touches other files', () => {
  const names = ['notes.txt', ...Array.from({ length: 12 }, (_, i) => `budget-backup-2026-11-${String(i + 10).padStart(2, '0')}.json`), 'budget-backup-old.json'];
  assert.deepEqual(backupsToRemove(names), ['budget-backup-2026-11-10.json', 'budget-backup-2026-11-11.json']);
  assert.deepEqual(backupsToRemove(names.slice(0, 5)), []);
});

test('writes the file and prunes old ones', async () => {
  const files = new Map<string, string>();
  for (let d = 1; d <= 10; d++) files.set(`budget-backup-2026-11-${String(d).padStart(2, '0')}.json`, 'old');
  files.set('mine.txt', 'keep');
  const folder: FolderHandle = {
    name: 'Backups',
    getFileHandle: async (name) => ({
      createWritable: async () => ({ write: async (data: string) => void files.set(name, data), close: async () => {} }),
    }),
    removeEntry: async (name) => void files.delete(name),
    async *values() {
      for (const name of [...files.keys()]) yield { kind: 'file', name };
    },
  };
  await writeBackup(folder, '{"x":1}', '2026-11-26');
  assert.equal(files.get('budget-backup-2026-11-26.json'), '{"x":1}');
  assert.equal(files.has('budget-backup-2026-11-01.json'), false);
  assert.equal(files.has('mine.txt'), true);
  assert.equal([...files.keys()].filter((n) => n.startsWith('budget-backup')).length, 10);
});
