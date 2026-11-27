import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blend, easeOut, ordinal, viewOf } from './morph.ts';

test('months count up by one across a year', () => {
  assert.equal(ordinal('2026-01') - ordinal('2025-12'), 1);
});

test('a view spans its months and keeps values per month', () => {
  const v = viewOf(['2026-01', '2026-02'], [[10, 20], [1, 2]], 0, 100);
  assert.equal(v.hi - v.lo, 2);
  assert.deepEqual(v.values.get(ordinal('2026-02')), [20, 2]);
});

test('blending moves the window, the range and shared values halfway', () => {
  const a = viewOf(['2026-05', '2026-06'], [[100, 200]], 0, 200);
  const b = viewOf(['2026-03', '2026-04', '2026-05', '2026-06'], [[0, 0, 300, 400]], 0, 400);
  const m = blend(a, b, 0.5);
  assert.equal(m.lo, ordinal('2026-04'));
  assert.equal(m.hi, ordinal('2026-07'));
  assert.equal(m.max, 300);
  assert.deepEqual(m.values.get(ordinal('2026-05')), [200]);
  // A month only the new view has keeps its value: it slides in from the edge.
  assert.deepEqual(m.values.get(ordinal('2026-03')), [0]);
});

test('a month only the old view has keeps its value while it slides out', () => {
  const a = viewOf(['2026-01', '2026-02'], [[5, 6]], 0, 10);
  const b = viewOf(['2026-02'], [[6]], 0, 10);
  assert.deepEqual(blend(a, b, 0.7).values.get(ordinal('2026-01')), [5]);
});

test('blending at the ends gives the views themselves', () => {
  const a = viewOf(['2026-01'], [[5]], 0, 10);
  const b = viewOf(['2026-01'], [[9]], 0, 20);
  assert.deepEqual(blend(a, b, 1).values.get(ordinal('2026-01')), [9]);
  assert.equal(blend(a, b, 0).max, 10);
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
});
