import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, serializeBackup } from '../db/backup.ts';
import { accountBalance, readyToAssign } from './budget.ts';
import { buildDemo } from './demo.ts';
import { monthOf } from './months.ts';
import { dueItems } from './recurring.ts';

// Month ends, February, New Year's Eve and the first of a month, in both languages.
const TODAYS = ['2026-11-27', '2026-12-31', '2027-01-01', '2027-02-28', '2028-02-29', '2027-07-15'];
const cases = TODAYS.flatMap((today) => (['en', 'de'] as const).map((language) => ({ today, language })));

test('the demo passes the same checks as a backup import', () => {
  for (const { today, language } of cases) {
    const parsed = parseBackup(serializeBackup(createBackup(buildDemo(today, language), 'EUR')));
    assert.ok(parsed.ok, `${today} ${language}: ${parsed.ok ? '' : parsed.error}`);
  }
});

test('the demo has a year of real dates and nothing after today', () => {
  for (const { today, language } of cases) {
    const state = buildDemo(today, language);
    const dates = state.transactions.map((t) => t.date);
    for (const d of dates) {
      assert.ok(d <= today, `${today}: ${d} is in the future`);
      assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d, `${d} is not a real date`);
    }
    assert.ok(state.transactions.length > 250, `${today}: only ${state.transactions.length} transactions`);
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

test('the demo is the same every time and named in the chosen language', () => {
  assert.deepEqual(buildDemo('2026-11-27', 'en'), buildDemo('2026-11-27', 'en'));
  const de = buildDemo('2026-11-27', 'de');
  assert.equal(de.accounts[0]!.name, 'Girokonto');
  assert.ok(de.categories.some((c) => c.name === 'Miete'));
  assert.ok(buildDemo('2026-11-27', 'en').categories.some((c) => c.name === 'Rent'));
});
