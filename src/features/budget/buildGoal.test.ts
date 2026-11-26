import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoal, goalToForm } from './buildGoal.ts';

test('save up to X, with and without a date', () => {
  const a = buildGoal({ type: 'target_balance', amount: 100000, targetDate: '' }, 'c', 'g');
  assert.ok(a.ok);
  assert.deepEqual(a.goal, { id: 'g', categoryId: 'c', type: 'target_balance', targetAmount: 100000 });
  const b = buildGoal({ type: 'target_balance', amount: 100000, targetDate: '2026-12' }, 'c', 'g');
  assert.ok(b.ok);
  assert.equal(b.goal.targetDate, '2026-12');
});

test('monthly amount ignores any date', () => {
  const r = buildGoal({ type: 'monthly_amount', amount: 90000, targetDate: '2026-12' }, 'c', 'g');
  assert.ok(r.ok);
  assert.deepEqual(r.goal, { id: 'g', categoryId: 'c', type: 'monthly_amount', monthlyAmount: 90000 });
});

test('an invalid month is rejected', () => {
  assert.equal(buildGoal({ type: 'target_balance', amount: 5000, targetDate: 'soon' }, 'c', 'g').ok, false);
});

test('zero or negative amounts are rejected', () => {
  assert.equal(buildGoal({ type: 'target_balance', amount: 0, targetDate: '' }, 'c', 'g').ok, false);
});

test('goalToForm reverses buildGoal', () => {
  for (const form of [
    { type: 'target_balance' as const, amount: 100000, targetDate: '' },
    { type: 'target_balance' as const, amount: 5000, targetDate: '2026-06' },
    { type: 'monthly_amount' as const, amount: 90000, targetDate: '' },
  ]) {
    const r = buildGoal(form, 'c', 'g');
    assert.ok(r.ok);
    assert.deepEqual(goalToForm(r.goal), form);
  }
});
