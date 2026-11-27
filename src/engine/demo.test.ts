import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, serializeBackup } from '../db/backup.ts';
import { accountBalance, readyToAssign } from './budget.ts';
import { buildDemo } from './demo.ts';
import { addMonths, monthOf } from './months.ts';
import { dueItems } from './recurring.ts';
import { autoAssignPlan } from './autoassign.ts';

// Month ends, February, New Year's Eve and the first of a month, in both languages.
const TODAYS = ['2026-11-27', '2026-12-31', '2027-01-01', '2027-02-28', '2028-02-29', '2027-07-15'];
const cases = TODAYS.flatMap((today) => (['en', 'de'] as const).map((language) => ({ today, language })));

test('the demo passes the same checks as a backup import', () => {
  for (const { today, language } of cases) {
    const parsed = parseBackup(serializeBackup(createBackup(buildDemo(today, language), 'EUR')));
    assert.ok(parsed.ok, `${today} ${language}: ${parsed.ok ? '' : parsed.error}`);
  }
});

test('the demo has two years of real dates and nothing after today', () => {
  for (const { today, language } of cases) {
    const state = buildDemo(today, language);
    const dates = state.transactions.map((t) => t.date);
    for (const d of dates) {
      assert.ok(d <= today, `${today}: ${d} is in the future`);
      assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d, `${d} is not a real date`);
    }
    assert.ok(state.transactions.length > 500, `${today}: only ${state.transactions.length} transactions`);
    // The longest chart range is 24 months: the data starts 23 months before this one.
    const first = dates.reduce((a, b) => (a < b ? a : b));
    assert.equal(monthOf(first), addMonths(monthOf(today), -23), today);
    assert.ok(dates.some((d) => monthOf(d) === monthOf(today)), `${today}: nothing this month`);
  }
});

test('the demo assigns each category at most once a month and leaves 180 to assign', () => {
  for (const { today, language } of cases) {
    const state = buildDemo(today, language);
    const keys = state.monthlyBudgets.map((b) => `${b.categoryId}@${b.month}`);
    assert.equal(new Set(keys).size, keys.length, `${today}: a category is assigned twice in a month`);
    assert.equal(readyToAssign(state, monthOf(today)), 18000, today);
  }
});

test('one recurring transaction is due, and accounts end up believable', () => {
  for (const { today, language } of cases) {
    const state = buildDemo(today, language);
    assert.deepEqual(dueItems(state.recurring, today).map((d) => d.recurringId), ['rec-netflix'], today);
    assert.ok(accountBalance(state, 'acc-giro') > 0, `${today}: checking account is overdrawn`);
    assert.ok(accountBalance(state, 'acc-tv') < 0, `${today}: the TV financing is paid off already`);
  }
});

test('Auto-assign has one goal to fund in the demo, and the money for it', () => {
  for (const { today, language } of cases) {
    const plan = autoAssignPlan(buildDemo(today, language), monthOf(today));
    assert.deepEqual(plan.steps, [{ categoryId: 'cat-groc', add: 12000 }], today);
    assert.ok(plan.readyAfter >= 0, today);
  }
});

test('the demo has yearly goals whose due month lines up with their bills', () => {
  for (const { today, language } of cases) {
    const state = buildDemo(today, language);
    const ins = state.goals.find((g) => g.categoryId === 'cat-ins')!;
    assert.equal(ins.repeatMonths, 12);
    const bills = state.transactions.filter((t) => t.categoryId === 'cat-ins').map((t) => t.date.slice(5, 7));
    assert.ok(bills.length > 0 && bills.every((m) => m === ins.targetDate!.slice(5, 7)), `${today}: insurance bills in ${bills} but due in ${ins.targetDate}`);
  }
});

test('the demo is the same every time and named in the chosen language', () => {
  assert.deepEqual(buildDemo('2026-11-27', 'en'), buildDemo('2026-11-27', 'en'));
  const de = buildDemo('2026-11-27', 'de');
  assert.equal(de.accounts[0]!.name, 'Girokonto');
  assert.ok(de.categories.some((c) => c.name === 'Miete'));
  assert.ok(buildDemo('2026-11-27', 'en').categories.some((c) => c.name === 'Rent'));
});
