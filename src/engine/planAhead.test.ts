import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignedAfter, availableToAssign, monthSummary, overspentIn, readyToAssign } from './budget.ts';
import { assignPlan } from './autoassign.ts';
import { buildDemo } from './demo.ts';
import { addMonths } from './months.ts';
import type { BudgetState, MonthlyBudget, Transaction } from './types.ts';

// 2.800 € in the checking account at the start of November, nothing assigned yet.
const state = (budgets: MonthlyBudget[] = [], transactions: Transaction[] = [], opening = 280000): BudgetState => ({
  accounts: [{ id: 'giro', name: 'Girokonto', type: 'checking', openingBalance: opening, sortOrder: 0, closed: false }],
  groups: [{ id: 'g', name: 'Wohnen', sortOrder: 0, archived: false }],
  categories: [
    { id: 'rent', groupId: 'g', name: 'Miete', sortOrder: 0, archived: false },
    { id: 'old', groupId: 'g', name: 'Alt', sortOrder: 1, archived: true },
  ],
  goals: [{ id: 'goal', categoryId: 'rent', type: 'monthly_amount', monthlyAmount: 50000 }],
  monthlyBudgets: budgets,
  recurring: [],
  transactions,
});
const salary = (date: string, amount: number): Transaction => ({ id: date, accountId: 'giro', date, payee: 'Arbeitgeber', categoryId: null, memo: '', amount, transferAccountId: null });
const NOV = '2026-11', DEC = '2026-12', JAN = '2027-01', OCT = '2026-10';

test('the example: 500 € assigned to December leaves 2.300 € in both November and December', () => {
  const s = state([{ categoryId: 'rent', month: DEC, assigned: 50000 }]);
  assert.equal(availableToAssign(s, NOV, NOV), 230000);
  assert.equal(availableToAssign(s, DEC, NOV), 230000);
  assert.equal(readyToAssign(s, NOV), 280000, 'the calculation underneath is unchanged');
});

test('a later month also counts what is planned after it', () => {
  const s = state([{ categoryId: 'rent', month: DEC, assigned: 50000 }, { categoryId: 'rent', month: JAN, assigned: 50000 }]);
  assert.equal(availableToAssign(s, NOV, NOV), 180000);
  assert.equal(availableToAssign(s, DEC, NOV), 180000);
  assert.equal(availableToAssign(s, JAN, NOV), 180000);
});

test('past months show what they always showed', () => {
  const s = state([{ categoryId: 'rent', month: DEC, assigned: 50000 }]);
  assert.equal(availableToAssign(s, OCT, NOV), readyToAssign(s, OCT));
});

test('without money planned ahead nothing changes, in any month of the sample data', () => {
  const s = buildDemo('2026-11-27', 'de');
  for (let m = '2024-10'; m <= '2027-03'; m = addMonths(m, 1)) assert.equal(availableToAssign(s, m, NOV), readyToAssign(s, m), m);
});

test('on the first of the month the new month carries on where the old one stopped', () => {
  // November slightly overspent, December assigned ahead, December's salary arrives on the 1st.
  const s = state(
    [{ categoryId: 'rent', month: NOV, assigned: 10000 }, { categoryId: 'rent', month: DEC, assigned: 50000 }],
    [{ ...salary('2026-11-20', 0), amount: -12000, categoryId: 'rent', payee: 'Vermieter' }, salary('2026-12-01', 260000)],
  );
  const novemberSeenInNovember = availableToAssign(s, NOV, NOV);
  const decemberSeenInDecember = availableToAssign(s, DEC, DEC);
  assert.equal(decemberSeenInDecember, novemberSeenInNovember + overspentIn(s, NOV) + 260000);
});

test('more planned than there is makes the pill go below zero', () => {
  const s = state([{ categoryId: 'rent', month: DEC, assigned: 300000 }]);
  assert.equal(availableToAssign(s, NOV, NOV), -20000);
});

test('income dated in a later month is not there yet: assigning it ahead shows red until it arrives', () => {
  const s = state([{ categoryId: 'rent', month: DEC, assigned: 260000 }], [salary('2026-12-01', 260000)], 0);
  assert.equal(availableToAssign(s, NOV, NOV), -260000);
  assert.equal(availableToAssign(s, DEC, NOV), 0);
  assert.equal(availableToAssign(s, DEC, DEC), 0, 'once December has come');
});

test('archived categories do not count, as everywhere in Ready to Assign', () => {
  const s = state([{ categoryId: 'old', month: DEC, assigned: 50000 }]);
  assert.equal(assignedAfter(s, NOV), 0);
  assert.equal(availableToAssign(s, NOV, NOV), 280000);
});

test('Auto-assign compares against what is really free', () => {
  const s = state([{ categoryId: 'rent', month: DEC, assigned: 250000 }]);
  const plan = assignPlan(s, NOV, 'goals', NOV);
  assert.equal(plan.total, 50000);
  assert.equal(plan.readyAfter, 280000 - 250000 - 50000);
  assert.equal(assignPlan(s, NOV, 'goals').readyAfter, 230000, 'without the current month: as before');
});

test('the month overview still adds up, with the planned-ahead line', () => {
  const base = buildDemo('2026-11-27', 'en');
  const s: BudgetState = { ...base, monthlyBudgets: [...base.monthlyBudgets, { categoryId: 'cat-rent', month: '2026-12', assigned: 95000 }, { categoryId: 'cat-hol', month: '2027-02', assigned: 20000 }] };
  for (let m = '2026-06'; m <= '2027-03'; m = addMonths(m, 1)) {
    const sum = monthSummary(s, m, NOV);
    assert.equal(sum.readyToAssign, availableToAssign(s, m, NOV), m);
    assert.equal(sum.plannedLater, m < NOV ? 0 : assignedAfter(s, m), m);
  }
  assert.equal(monthSummary(s, NOV, NOV).plannedLater, 115000);
});
