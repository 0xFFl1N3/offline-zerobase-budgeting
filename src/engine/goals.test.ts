import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueMonth, goalProgress } from './budget.ts';
import { autoAssignPlan } from './autoassign.ts';
import { addMonths } from './months.ts';
import { createBackup, parseBackup, serializeBackup } from '../db/backup.ts';
import type { BudgetState, Goal, Transaction } from './types.ts';

// Insurance: 480 € due in March, saved up for in the months before.
const goal = (extra: Partial<Goal> = {}): Goal => ({ id: 'g', categoryId: 'ins', type: 'target_balance', targetAmount: 48000, targetDate: '2027-03', ...extra });
const yearly = goal({ repeatMonths: 12 });
let n = 0;
const bill = (date: string, amount: number): Transaction => ({ id: `t${++n}`, accountId: 'a', date, payee: 'Allianz', categoryId: 'ins', memo: '', amount: -amount, transferAccountId: null });
/** A budget assigning `each` to insurance every month from `from` to `to`, plus any extra assignments and bills. */
function budget(g: Goal, opts: { from?: string; to?: string; each?: number; extra?: [string, number][]; bills?: Transaction[] } = {}): BudgetState {
  const monthlyBudgets = [];
  if (opts.from && opts.to) for (let m = opts.from; m <= opts.to; m = addMonths(m, 1)) monthlyBudgets.push({ categoryId: 'ins', month: m, assigned: opts.each ?? 4000 });
  for (const [month, assigned] of opts.extra ?? []) monthlyBudgets.push({ categoryId: 'ins', month, assigned });
  return {
    accounts: [{ id: 'a', name: 'Checking', type: 'checking', openingBalance: 1000000, sortOrder: 0, closed: false }],
    groups: [{ id: 'grp', name: 'Living', sortOrder: 0, archived: false }],
    categories: [{ id: 'ins', groupId: 'grp', name: 'Insurance', sortOrder: 0, archived: false }],
    goals: [g], monthlyBudgets, recurring: [], transactions: opts.bills ?? [],
  };
}
const need = (s: BudgetState, month: string) => goalProgress(s, s.goals[0]!, month).neededThisMonth;

test('the due month moves on in steps for a repeating goal and stays for a one-time one', () => {
  assert.equal(dueMonth(yearly, '2026-11'), '2027-03');
  assert.equal(dueMonth(yearly, '2027-03'), '2027-03', 'the due month itself still aims at it');
  assert.equal(dueMonth(yearly, '2027-04'), '2028-03');
  assert.equal(dueMonth(goal({ repeatMonths: 3 }), '2027-05'), '2027-06');
  assert.equal(dueMonth(goal(), '2027-08'), '2027-03');
  assert.equal(dueMonth(goal({ targetDate: undefined }), '2027-08'), undefined);
});

test('1: what is missing is spread over the months up to the due month', () => {
  const s = budget(yearly, { from: '2026-04', to: '2026-10' }); // 280 by the start of November
  assert.equal(need(s, '2026-11'), 4000); // (480 - 280) over Nov to Mar
});

test('2: after the bill in the due month, the goal is met there and starts over the month after', () => {
  const s = budget(yearly, { from: '2026-04', to: '2027-03', bills: [bill('2027-03-05', 48000)] });
  const march = goalProgress(s, yearly, '2027-03');
  assert.deepEqual([march.current, march.percent, march.neededThisMonth], [48000, 100, 0], 'the bill does not make March ask again');
  const april = goalProgress(s, yearly, '2027-04');
  assert.deepEqual([april.dueMonth, april.current, april.neededThisMonth], ['2028-03', 0, 4000]);
});

test('3 and 4: a cheaper bill leaves money for the next round; a dearer one starts it from zero', () => {
  const cheaper = budget(yearly, { from: '2026-04', to: '2027-03', bills: [bill('2027-03-05', 45000)] });
  assert.equal(need(cheaper, '2027-04'), 3750); // (480 - 30) over twelve months
  const dearer = budget(yearly, { from: '2026-04', to: '2027-03', bills: [bill('2027-03-05', 50000)] });
  assert.equal(need(dearer, '2027-04'), 4000); // the 20 overspent are cleared from Ready to Assign, as always
});

test('5: a goal started late catches up by the due month, then goes back to the normal pace', () => {
  const s = budget(yearly, { from: '2026-12', to: '2027-03', each: 12000, bills: [bill('2027-03-05', 48000)] });
  assert.equal(need(budget(yearly), '2026-12'), 12000); // 480 over Dec to Mar, nothing saved yet
  assert.equal(need(s, '2027-04'), 4000);
});

test('6: Fund goals uses the same amount', () => {
  const s = budget(yearly, { from: '2026-04', to: '2026-10' });
  assert.deepEqual(autoAssignPlan(s, '2026-11').steps, [{ categoryId: 'ins', add: 4000 }]);
});

test('spending from the category before the due month has to be made up', () => {
  const s = budget(goal(), { extra: [['2027-01', 48000]], bills: [bill('2027-02-10', 10000)] });
  assert.equal(need(s, '2027-02'), 10000);
});

test('a one-time goal met in its due month asks for nothing afterwards; one that was not keeps asking for the rest', () => {
  const met = budget(goal(), { from: '2026-04', to: '2027-03', bills: [bill('2027-03-05', 48000)] });
  const after = goalProgress(met, met.goals[0]!, '2027-06');
  assert.deepEqual([after.percent, after.neededThisMonth, after.pastDue], [100, 0, true]);
  assert.equal(goalProgress(met, met.goals[0]!, '2027-03').pastDue, undefined, 'not in the due month itself');
  assert.deepEqual(autoAssignPlan(met, '2027-06').steps, []);
  const short = budget(goal(), { from: '2026-10', to: '2027-03', each: 5000 }); // 300 by March
  assert.equal(need(short, '2027-04'), 18000);
  const caughtUp = budget(goal(), { from: '2026-10', to: '2027-03', each: 5000, extra: [['2027-04', 18000]] });
  assert.equal(need(caughtUp, '2027-04'), 0);
});

test('a goal without a date still refills after spending', () => {
  const s = budget(goal({ targetDate: undefined }), { extra: [['2026-01', 48000]], bills: [bill('2026-02-03', 10000)] });
  assert.equal(need(s, '2026-02'), 10000);
});

test('7 and 8: the repeat survives a backup; a wrong one is refused', () => {
  const s = budget(yearly);
  const back = parseBackup(serializeBackup(createBackup(s, 'EUR')));
  assert.ok(back.ok && back.backup.data.goals[0]!.repeatMonths === 12);
  for (const bad of [{ ...yearly, repeatMonths: 5 }, { ...yearly, targetDate: undefined }]) {
    assert.equal(parseBackup(serializeBackup(createBackup({ ...s, goals: [bad as Goal] }, 'EUR'))).ok, false);
  }
  const oneTime = { ...yearly };
  delete oneTime.repeatMonths;
  assert.equal(dueMonth(oneTime, '2027-04'), '2027-03', 'without the repeat it is a one-time goal again');
});
