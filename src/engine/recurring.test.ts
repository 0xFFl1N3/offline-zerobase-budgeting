import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonthsClamped } from './dates.ts';
import { removeAccount, removeCategories } from './edit.ts';
import {
  bookNext, dueDates, dueItems, nextDate, occurrenceDate, recurringFrom, setRecurringPaused, skipNext, startRecurring, updateRecurring,
} from './recurring.ts';
import type { BudgetState, RecurringTransaction, Transaction } from './types.ts';

const rent: Transaction = {
  id: 't1', accountId: 'a', date: '2026-01-31', payee: 'Landlord', categoryId: 'rent', memo: 'rent', amount: -90000, transferAccountId: null,
};
const series = (over: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  ...recurringFrom(rent, 'monthly', null, 'r1'), ...over,
});

test('date arithmetic keeps the day where it can and clamps to the end of the month', () => {
  assert.equal(addDays('2026-12-30', 5), '2027-01-04');
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsClamped('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonthsClamped('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonthsClamped('2026-03-15', -4), '2025-11-15');
});

test('occurrences are counted from the start so a 31st does not drift', () => {
  assert.deepEqual([1, 2, 3].map((i) => occurrenceDate('2026-01-31', 'monthly', i)), ['2026-02-28', '2026-03-31', '2026-04-30']);
  assert.equal(occurrenceDate('2026-03-02', 'weekly', 2), '2026-03-16');
  assert.equal(occurrenceDate('2026-03-02', 'biweekly', 2), '2026-03-30');
  assert.equal(occurrenceDate('2024-02-29', 'yearly', 1), '2025-02-28');
});

test('a series made from an existing transaction starts at its next occurrence', () => {
  const r = series();
  assert.equal(nextDate(r), '2026-02-28');
  assert.deepEqual(dueDates(r, '2026-02-27'), []);
  assert.deepEqual(dueDates(r, '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
});

test('every missed occurrence is due; the list shows the oldest and counts the rest', () => {
  const items = dueItems([series(), series({ id: 'r2', paused: true })], '2026-04-30');
  assert.deepEqual(items, [{ recurringId: 'r1', date: '2026-02-28', moreAfter: 2 }]);
});

test('the end date stops the series', () => {
  const r = series({ endDate: '2026-03-31' });
  assert.deepEqual(dueDates(r, '2027-01-01'), ['2026-02-28', '2026-03-31']);
  const done = series({ endDate: '2026-03-31', handled: 3 });
  assert.equal(nextDate(done), null);
  assert.throws(() => bookNext(done, 'x'), /ended/);
});

test('confirming books a transaction on the due date and moves on; the amount can be overridden', () => {
  const { transaction, recurring } = bookNext(series(), 'new', 85000);
  assert.deepEqual(
    [transaction.id, transaction.date, transaction.amount, transaction.payee, transaction.categoryId],
    ['new', '2026-02-28', -85000, 'Landlord', 'rent'],
  );
  assert.equal(nextDate(recurring), '2026-03-31');
  assert.equal(bookNext(series(), 'n2').transaction.amount, -90000);
});

test('a split series keeps its parts and ignores an amount override', () => {
  const split: Transaction = { ...rent, categoryId: null, splits: [{ categoryId: 'a', amount: -60000 }, { categoryId: 'b', amount: -30000 }] };
  const r = recurringFrom(split, 'monthly', null, 'r');
  const { transaction } = bookNext(r, 'n', 1);
  assert.equal(transaction.amount, -90000);
  assert.deepEqual(transaction.splits, [{ categoryId: 'a', amount: -60000 }, { categoryId: 'b', amount: -30000 }]);
  assert.notEqual(transaction.splits, r.template.splits); // a copy, not shared
});

test('inflows and transfers keep their sign', () => {
  const pay = recurringFrom({ ...rent, amount: 250000, categoryId: null }, 'monthly', null, 'p');
  assert.equal(bookNext(pay, 'n', 260000).transaction.amount, 260000);
  const move = recurringFrom({ ...rent, amount: -5000, categoryId: null, transferAccountId: 'b' }, 'monthly', null, 'm');
  const booked = bookNext(move, 'n', 6000).transaction;
  assert.deepEqual([booked.amount, booked.transferAccountId], [-6000, 'b']);
});

test('skipping moves on without booking', () => {
  assert.equal(nextDate(skipNext(series())), '2026-03-31');
});

test('a series started from a new transaction books it now, or waits if it is in the future', () => {
  const past = startRecurring({ ...rent, date: '2026-05-01' }, 'weekly', null, '2026-05-10', 'r');
  assert.equal(past.transaction?.date, '2026-05-01');
  assert.equal(nextDate(past.recurring), '2026-05-08');
  const future = startRecurring({ ...rent, date: '2026-06-01' }, 'weekly', null, '2026-05-10', 'r');
  assert.equal(future.transaction, null);
  assert.deepEqual(dueDates(future.recurring, '2026-06-08'), ['2026-06-01', '2026-06-08']);
  assert.throws(() => startRecurring(rent, 'weekly', '2026-01-01', '2026-02-01', 'r'), /end date/);
});

test('changing the frequency restarts from the next occurrence; other edits keep the schedule', () => {
  const edited = updateRecurring(series(), { frequency: 'weekly', amount: 80000, payee: ' Landlord Inc ', endDate: '2026-12-31' });
  assert.equal(nextDate(edited), '2026-02-28');
  assert.deepEqual([edited.template.amount, edited.template.payee, edited.endDate], [-80000, 'Landlord Inc', '2026-12-31']);
  assert.equal(occurrenceDate(edited.startDate, edited.frequency, edited.handled + 1), '2026-03-07');
  assert.throws(() => updateRecurring(series(), { endDate: '2026-02-01' }), /end date/);
  assert.throws(() => updateRecurring(series(), { amount: 0 }), /greater than zero/);
});

test('resuming skips what fell into the pause', () => {
  const paused = setRecurringPaused(series(), true, '2026-02-01');
  assert.deepEqual(dueDates(paused, '2026-06-01'), []);
  const resumed = setRecurringPaused(paused, false, '2026-05-10');
  assert.equal(resumed.paused, false);
  assert.equal(nextDate(resumed), '2026-05-31');
  assert.deepEqual(dueDates(resumed, '2026-05-10'), []);
});

test('accounts and categories used by a series cannot be deleted', () => {
  const state: BudgetState = {
    accounts: [{ id: 'a', name: 'A', type: 'checking', openingBalance: 0, sortOrder: 0, closed: false }],
    groups: [{ id: 'g', name: 'G', sortOrder: 0, archived: false }],
    categories: [{ id: 'rent', groupId: 'g', name: 'Rent', sortOrder: 0, archived: false }],
    goals: [], monthlyBudgets: [], transactions: [], recurring: [series()],
  };
  assert.throws(() => removeAccount(state, 'a'), /Close it instead/);
  assert.throws(() => removeCategories(state, ['rent']), /Archive it instead/);
});
