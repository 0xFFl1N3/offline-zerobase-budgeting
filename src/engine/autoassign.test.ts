import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignPlan, autoAssignPlan, lastMonthPlan, overspendingPlan, planAssignments } from './autoassign.ts';
import { categoryAvailable, goalProgress, readyToAssign } from './budget.ts';
import type { BudgetState } from './types.ts';

const M = '2026-01';
const state = (): BudgetState => ({
  accounts: [{ id: 'a', name: 'Checking', type: 'checking', openingBalance: 200000, sortOrder: 0, closed: false }],
  groups: [{ id: 'g', name: 'Living', sortOrder: 0, archived: false }],
  categories: [
    { id: 'rent', groupId: 'g', name: 'Rent', sortOrder: 0, archived: false },
    { id: 'pc', groupId: 'g', name: 'Computer', sortOrder: 1, archived: false },
    { id: 'fun', groupId: 'g', name: 'Fun', sortOrder: 2, archived: false },
    { id: 'old', groupId: 'g', name: 'Old', sortOrder: 3, archived: true },
    { id: 'none', groupId: 'g', name: 'No goal', sortOrder: 4, archived: false },
  ],
  goals: [
    { id: 'g1', categoryId: 'rent', type: 'monthly_amount', monthlyAmount: 90000 },
    { id: 'g2', categoryId: 'pc', type: 'target_balance', targetAmount: 120000, targetDate: '2026-08' }, // 8 months: 150/month
    { id: 'g3', categoryId: 'fun', type: 'target_balance', targetAmount: 5000 },
    { id: 'g4', categoryId: 'old', type: 'monthly_amount', monthlyAmount: 1000 },
  ],
  monthlyBudgets: [{ categoryId: 'fun', month: M, assigned: 5000 }], // already fully funded
  recurring: [],
  transactions: [],
});

test('plan covers every active goal that still needs money, skipping funded, archived and goal-less categories', () => {
  const plan = autoAssignPlan(state(), M);
  assert.deepEqual(plan.steps, [
    { categoryId: 'rent', add: 90000 },
    { categoryId: 'pc', add: 15000 },
  ]);
  assert.equal(plan.total, 105000);
  assert.equal(plan.readyAfter, readyToAssign(state(), M) - 105000);
});

test('partly funded categories only get the difference', () => {
  const s = state();
  s.monthlyBudgets.push({ categoryId: 'rent', month: M, assigned: 40000 });
  const plan = autoAssignPlan(s, M);
  assert.equal(plan.steps.find((x) => x.categoryId === 'rent')!.add, 50000);
});

test('applying the plan funds the goals, and a second plan is empty', () => {
  let s = state();
  const plan = autoAssignPlan(s, M);
  s = { ...s, monthlyBudgets: [...s.monthlyBudgets.filter((b) => !plan.steps.some((p) => p.categoryId === b.categoryId)), ...planAssignments(s, plan, M).map((a) => ({ ...a, month: M }))] };
  assert.equal(categoryAvailable(s, 'rent', M), 90000);
  assert.equal(goalProgress(s, s.goals[1]!, M).neededThisMonth, 0);
  assert.equal(autoAssignPlan(s, M).steps.length, 0);
  assert.equal(readyToAssign(s, M), plan.readyAfter);
});

test('the plan can exceed Ready to Assign, which shows as a negative result', () => {
  const s = state();
  s.accounts[0]!.openingBalance = 50000;
  assert.ok(autoAssignPlan(s, M).readyAfter < 0);
});

const spend = (id: string, categoryId: string, amount: number, date = `${M}-10`) => ({
  id, accountId: 'a', date, payee: 'Shop', categoryId, memo: '', amount, transferAccountId: null,
});

test('covering overspending brings each red category back to zero, and only those', () => {
  const s = state();
  s.monthlyBudgets.push({ categoryId: 'none', month: M, assigned: 1000 });
  s.transactions.push(spend('t1', 'none', -1940), spend('t2', 'fun', -2000), spend('t3', 'old', -500));
  const plan = overspendingPlan(s, M);
  assert.deepEqual(plan.steps, [{ categoryId: 'none', add: 940 }]); // fun still has 30.00; old is archived
  const after = { ...s, monthlyBudgets: [...s.monthlyBudgets.filter((b) => b.categoryId !== 'none'), ...planAssignments(s, plan, M).map((a) => ({ ...a, month: M }))] };
  assert.equal(categoryAvailable(after, 'none', M), 0);
});

test('same as last month copies last month into categories with nothing assigned yet', () => {
  const s = state();
  const prev = '2025-12';
  s.monthlyBudgets.push({ categoryId: 'rent', month: prev, assigned: 90000 }, { categoryId: 'fun', month: prev, assigned: 7000 }, { categoryId: 'old', month: prev, assigned: 300 });
  // fun already has money this month, old is archived, pc got nothing last month.
  assert.deepEqual(lastMonthPlan(s, M).steps, [{ categoryId: 'rent', add: 90000 }]);
});

test('each kind reports nothing to do when there is nothing to do', () => {
  const s = state();
  s.monthlyBudgets = [];
  s.goals = [];
  for (const kind of ['goals', 'overspending', 'lastMonth'] as const) assert.equal(assignPlan(s, M, kind).steps.length, 0, kind);
});

test('with ticked categories, only those are filled, whatever the kind', () => {
  const s = state();
  const plan = assignPlan(s, M, 'goals', undefined, new Set(['pc', 'fun']));
  assert.deepEqual(plan.steps, [{ categoryId: 'pc', add: 15000 }]);
  assert.equal(plan.total, 15000);
  assert.equal(plan.readyAfter, readyToAssign(s, M) - 15000);
  assert.deepEqual(assignPlan(s, M, 'goals', undefined, new Set()).steps, [], 'nothing ticked that needs money: nothing to do');
  assert.deepEqual(assignPlan(s, M, 'goals', undefined, new Set(['rent', 'pc'])), assignPlan(s, M, 'goals'), 'all that need money ticked: same as no selection');
});
