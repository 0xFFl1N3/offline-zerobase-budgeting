import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCollapsed } from './collapsed.ts';

test('collapsed groups are read back; anything unreadable means none', () => {
  assert.deepEqual([...parseCollapsed('["a","b"]')], ['a', 'b']);
  for (const bad of [null, '', 'nope', '{"a":1}', '[1,2]']) assert.equal(parseCollapsed(bad).size, 0, String(bad));
});
