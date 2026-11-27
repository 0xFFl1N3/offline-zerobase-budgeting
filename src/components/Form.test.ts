import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []));

// A plain <form> submitted by the browser reloads the page and puts the fields' values into the address bar.
// The shared Form component always prevents that, so every form has to be one.
test('no plain <form> outside the shared Form component', () => {
  const plain = files('src')
    .filter((f) => !f.endsWith(join('components', 'Form.tsx')))
    .flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${f}:${i + 1}` }))
        .filter(({ line }) => /<form\b/.test(line))
        .map(({ at }) => at),
    );
  assert.deepEqual(plain, []);
});

test('the shared Form stops the browser submit before anything else', () => {
  const source = readFileSync(join('src', 'components', 'Form.tsx'), 'utf8');
  assert.match(source, /onSubmit=\{\(e\) => \{\s*e\.preventDefault\(\);\s*onSubmit\(e\);/);
});
