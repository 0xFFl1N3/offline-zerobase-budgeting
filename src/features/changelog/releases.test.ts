import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_VERSION } from '../../version.ts';
import { fingerprint, minorOf, parseReleases, unseenReleases } from './releases.ts';

const sample = [
  '# What\'s new',
  '',
  'Intro.',
  '',
  '## 0.10 – Debts',
  '2026-11-27',
  '',
  '- Track loans.',
  '- Pay a debt by booking',
  '  its category.',
  '',
  '## 0.9 – Safer saving',
  '2026-11-26',
  '- A message when saving fails.',
].join('\n');

test('reads releases with title, date and items', () => {
  assert.deepEqual(parseReleases(sample), [
    { version: '0.10', title: 'Debts', date: '2026-11-27', items: ['Track loans.', 'Pay a debt by booking its category.'] },
    { version: '0.9', title: 'Safer saving', date: '2026-11-26', items: ['A message when saving fails.'] },
  ]);
  assert.equal(minorOf('0.10.8'), '0.10');
  assert.equal(minorOf('1.0.0'), '1.0');
});

test('a release counts as new when its notes change, not when the version does', () => {
  const releases = parseReleases(sample);
  const seen = Object.fromEntries(releases.map((r) => [r.version, fingerprint(r)]));
  assert.equal(unseenReleases(releases, seen).size, 0);
  const updated = parseReleases(sample.replace('- Track loans.', '- Track loans.\n- Choose the group.'));
  assert.deepEqual([...unseenReleases(updated, seen)], ['0.10']);
  const newer = parseReleases('## 0.11 – Next\n- Something.\n\n' + sample);
  assert.deepEqual([...unseenReleases(newer, seen)], ['0.11']);
});

test('RELEASES.md has notes for the current release, and CHANGELOG.md starts with the current version', async () => {
  const releases = parseReleases(await readFile(new URL('../../../RELEASES.md', import.meta.url), 'utf8'));
  const current = releases.find((r) => r.version === minorOf(APP_VERSION));
  assert.ok(current, `RELEASES.md needs a section for ${minorOf(APP_VERSION)}`);
  for (const r of releases) {
    assert.ok(r.title && r.items.length > 0, `${r.version} needs a title and at least one line`);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, `${r.version} needs a date`);
  }
  const changelog = await readFile(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
  assert.equal(/^## +(\S+)/m.exec(changelog)?.[1], APP_VERSION, 'CHANGELOG.md starts with the current version');
});
