import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []));

test('every input tells password managers to leave it alone', () => {
  const missing = files('src').flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, at: `${f}:${i + 1}` }))
      .filter(({ line }) => /<input\b/.test(line) && !line.includes('{...NO_AUTOFILL}'))
      .map(({ at }) => at),
  );
  assert.deepEqual(missing, []);
});
