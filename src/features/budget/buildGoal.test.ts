import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoal, goalToForm } from './buildGoal.ts';

test('keep ready is a goal without a month; save up by a month has one', () => {
  const a = buildGoal({ type: 'keep', amount: 30000, targetDate: '2026-12' }, 'c', 'g');
  assert.ok(a.ok);
  assert.deepEqual(a.goal, { id: 'g', categoryId: 'c', type: 'target_balance', targetAmount: 30000 }, 'a month left over from another kind is dropped');
  const b = buildGoal({ type: 'save_by', amount: 100000, targetDate: '2026-12' }, 'c', 'g');
  assert.ok(b.ok);
  assert.equal(b.goal.targetDate, '2026-12');
});

test('save up by a month needs a month', () => {
  assert.deepEqual(buildGoal({ type: 'save_by', amount: 5000, targetDate: '' }, 'c', 'g'), { ok: false, error: 'goal.errorMonth' });
  assert.equal(buildGoal({ type: 'save_by', amount: 5000, targetDate: 'soon' }, 'c', 'g').ok, false);
});

test('monthly amount ignores any date', () => {
  const r = buildGoal({ type: 'monthly', amount: 90000, targetDate: '2026-12' }, 'c', 'g');
  assert.ok(r.ok);
  assert.deepEqual(r.goal, { id: 'g', categoryId: 'c', type: 'monthly_amount', monthlyAmount: 90000 });
});

test('zero or negative amounts are rejected', () => {
  assert.equal(buildGoal({ type: 'keep', amount: 0, targetDate: '' }, 'c', 'g').ok, false);
});

test('goalToForm reverses buildGoal', () => {
  for (const form of [
    { type: 'keep' as const, amount: 100000, targetDate: '' },
    { type: 'save_by' as const, amount: 5000, targetDate: '2026-06' },
    { type: 'save_by' as const, amount: 48000, targetDate: '2027-03', repeatMonths: 12 as const },
    { type: 'monthly' as const, amount: 90000, targetDate: '' },
  ]) {
    const r = buildGoal(form, 'c', 'g');
    assert.ok(r.ok);
    assert.deepEqual(goalToForm(r.goal), form);
  }
});

test('the repeat only belongs to save up by a month', () => {
  const keep = buildGoal({ type: 'keep', amount: 48000, targetDate: '', repeatMonths: 12 }, 'c', 'g');
  assert.ok(keep.ok && keep.goal.repeatMonths === undefined);
});
