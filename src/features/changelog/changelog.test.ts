import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseChangelog } from './changelog.ts';

test('reads versions, sections and items', () => {
  const text = [
    '# Changelog',
    '',
    'Intro text.',
    '',
    '## 0.8.0 – 2026-11-26',
    '',
    '### Added',
    '- Undo after a delete.',
    '- Second item that',
    '  wraps onto a new line.',
    '',
    '### Fixed',
    '- A bug.',
    '',
    '## 0.7.4 - 2026-11-25',
    '- Item without a section.',
  ].join('\n');
  assert.deepEqual(parseChangelog(text), [
    {
      version: '0.8.0',
      date: '2026-11-26',
      sections: [
        { title: 'Added', items: ['Undo after a delete.', 'Second item that wraps onto a new line.'] },
        { title: 'Fixed', items: ['A bug.'] },
      ],
    },
    { version: '0.7.4', date: '2026-11-25', sections: [{ title: '', items: ['Item without a section.'] }] },
  ]);
});

test('compares versions by number', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.ok(compareVersions('0.8.0', '0.8.1') < 0);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
});

test('the real changelog parses and starts with the current version', async () => {
  const { readFile } = await import('node:fs/promises');
  const { APP_VERSION } = await import('../../version.ts');
  const entries = parseChangelog(await readFile(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.equal(entries[0]?.version, APP_VERSION);
  for (const e of entries) assert.ok(e.sections.some((s) => s.items.length > 0), `${e.version} has no items`);
});
