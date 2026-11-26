import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceScale } from './scale.ts';

test('nice scale starts at zero and rounds the top up to a tick', () => {
  const s = niceScale([12345, 87000]);
  assert.equal(s.min, 0);
  assert.ok(s.max >= 87000);
  assert.equal(s.ticks[0], 0);
  assert.equal(s.ticks.at(-1), s.max);
  assert.ok(s.ticks.length >= 3 && s.ticks.length <= 6);
});

test('negative values extend the scale below zero, and zero is a tick', () => {
  const s = niceScale([-30000, 50000]);
  assert.ok(s.min <= -30000);
  assert.ok(s.ticks.includes(0));
});

test('all zeros still gives a usable scale', () => {
  assert.deepEqual(niceScale([0, 0]), { min: 0, max: 100, ticks: [0, 100] });
});
