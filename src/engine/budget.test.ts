import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BudgetState, Transaction } from './types.ts';
import {
  accountBalance,
  categoryActivity,
  categoryAvailable,
  goalProgress,
  isOverspent,
  readyToAssign,
  runningBalances,
} from './budget.ts';

const JAN = '2026-01';
const FEB = '2026-02';

function baseState(): BudgetState {
  return {
    accounts: [
      { id: 'chk', name: 'Checking', type: 'checking', openingBalance: 100000, sortOrder: 0, closed: false },
      { id: 'sav', name: 'Savings', type: 'savings', openingBalance: 0, sortOrder: 0, closed: false },
    ],
    groups: [{ id: 'g1', name: 'Living', sortOrder: 0, archived: false }],
    categories: [
      { id: 'rent', groupId: 'g1', name: 'Rent', sortOrder: 0, archived: false },
      { id: 'power', groupId: 'g1', name: 'Electricity', sortOrder: 1, archived: false },
    ],
    goals: [],
    monthlyBudgets: [],
    recurring: [],
    transactions: [],
  };
}

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't' + Math.random(),
  accountId: 'chk',
  date: '2026-01-10',
  payee: 'Someone',
  categoryId: null,
  memo: '',
  amount: 0,
  transferAccountId: null,
  ...over,
});

test('initial balance is fully unassigned', () => {
  assert.equal(readyToAssign(baseState(), JAN), 100000);
});

test('assigning moves money from Ready to Assign into the category', () => {
  const s = baseState();
  s.monthlyBudgets.push({ categoryId: 'rent', month: JAN, assigned: 90000 });
  assert.equal(readyToAssign(s, JAN), 10000);
  assert.equal(categoryAvailable(s, 'rent', JAN), 90000);
});

test('categorised spending lowers account and category but not Ready to Assign', () => {
  const s = baseState();
  s.monthlyBudgets.push({ categoryId: 'rent', month: JAN, assigned: 90000 });
  s.transactions.push(tx({ categoryId: 'rent', amount: -50000 }));
  assert.equal(accountBalance(s, 'chk'), 50000);
  assert.equal(categoryActivity(s, 'rent', JAN), -50000);
  assert.equal(categoryAvailable(s, 'rent', JAN), 40000);
  assert.equal(readyToAssign(s, JAN), 10000);
});

test('unspent money rolls over to the next month', () => {
  const s = baseState();
  s.monthlyBudgets.push({ categoryId: 'rent', month: JAN, assigned: 90000 });
  s.transactions.push(tx({ categoryId: 'rent', amount: -50000 }));
  assert.equal(categoryAvailable(s, 'rent', FEB), 40000);
  assert.equal(categoryActivity(s, 'rent', FEB), 0);
});

test('uncategorised inflow is income and raises Ready to Assign', () => {
  const s = baseState();
  s.transactions.push(tx({ amount: 200000, payee: 'Employer' }));
  assert.equal(readyToAssign(s, JAN), 300000);
});

test('transfers move money between accounts without touching Ready to Assign', () => {
  const s = baseState();
  s.transactions.push(tx({ amount: -30000, transferAccountId: 'sav' }));
  assert.equal(accountBalance(s, 'chk'), 70000);
  assert.equal(accountBalance(s, 'sav'), 30000);
  assert.equal(readyToAssign(s, JAN), 100000);
});

test('spending more than available makes the category overspent', () => {
  const s = baseState();
  s.monthlyBudgets.push({ categoryId: 'power', month: JAN, assigned: 5000 });
  s.transactions.push(tx({ categoryId: 'power', amount: -8000 }));
  assert.equal(isOverspent(s, 'power', JAN), true);
  assert.equal(categoryAvailable(s, 'power', JAN), -3000);
});

test('target_balance goal uses the whole available balance', () => {
  const s = baseState();
  s.goals.push({ id: 'goal', categoryId: 'rent', type: 'target_balance', targetAmount: 100000 });
  s.monthlyBudgets.push({ categoryId: 'rent', month: JAN, assigned: 40000 });
  const jan = goalProgress(s, s.goals[0]!, JAN);
  assert.equal(jan.percent, 40);
  assert.equal(jan.neededThisMonth, 60000);
  // Nothing assigned in February, but January's balance still counts.
  const feb = goalProgress(s, s.goals[0]!, FEB);
  assert.equal(feb.current, 40000);
  assert.equal(feb.percent, 40);
});

test('target_balance goal with a date derives the monthly amount', () => {
  const s = baseState();
  s.goals.push({
    id: 'goal',
    categoryId: 'rent',
    type: 'target_balance',
    targetAmount: 120000,
    targetDate: '2026-06',
  });
  assert.equal(goalProgress(s, s.goals[0]!, JAN).neededThisMonth, 20000); // 6 months left
  s.monthlyBudgets.push({ categoryId: 'rent', month: JAN, assigned: 20000 });
  assert.equal(goalProgress(s, s.goals[0]!, JAN).neededThisMonth, 0);
  assert.equal(goalProgress(s, s.goals[0]!, FEB).neededThisMonth, 20000); // (120000-20000)/5
});

test('monthly_amount goal tracks this month\'s assignment', () => {
  const s = baseState();
  s.goals.push({ id: 'goal', categoryId: 'rent', type: 'monthly_amount', monthlyAmount: 90000 });
  s.monthlyBudgets.push({ categoryId: 'rent', month: JAN, assigned: 30000 });
  const p = goalProgress(s, s.goals[0]!, JAN);
  assert.equal(p.percent, 33.3);
  assert.equal(p.neededThisMonth, 60000);
  assert.equal(goalProgress(s, s.goals[0]!, FEB).neededThisMonth, 90000);
});

test('spending from a dated savings goal puts it behind again', () => {
  // The reported case: 1200 by 2027-06, viewed in 2026-11 (8 months left, 150/month).
  const s = baseState();
  s.goals.push({ id: 'goal', categoryId: 'rent', type: 'target_balance', targetAmount: 120000, targetDate: '2027-06' });
  s.monthlyBudgets.push({ categoryId: 'rent', month: '2026-11', assigned: 15000 });
  const goal = s.goals[0]!;
  assert.equal(goalProgress(s, goal, '2026-11').neededThisMonth, 0); // 150 assigned = 150 needed

  s.transactions.push(tx({ categoryId: 'rent', amount: -6000, date: '2026-11-10' })); // spend 60
  const p = goalProgress(s, goal, '2026-11');
  assert.equal(p.current, 9000); // 90 of 1200
  assert.equal(p.neededThisMonth, 6000); // 150 - 90 = 60 more to be on pace
});

test('a refund into the category reduces what is still needed', () => {
  const s = baseState();
  s.goals.push({ id: 'goal', categoryId: 'rent', type: 'target_balance', targetAmount: 120000, targetDate: '2026-06' });
  s.transactions.push(tx({ categoryId: 'rent', amount: 5000, date: '2026-01-10' }));
  assert.equal(goalProgress(s, s.goals[0]!, JAN).neededThisMonth, 15000); // 20000 - 5000
});

test('running balance follows date order and counts transfers on both sides', () => {
  const state: BudgetState = {
    accounts: [
      { id: 'a', name: 'A', type: 'checking', openingBalance: 10000, sortOrder: 0, closed: false },
      { id: 'b', name: 'B', type: 'savings', openingBalance: 0, sortOrder: 1, closed: false },
    ],
    groups: [], categories: [], goals: [], monthlyBudgets: [],
    recurring: [],
    transactions: [
      { id: 'late', accountId: 'a', date: '2026-01-09', payee: '', categoryId: null, memo: '', amount: -500, transferAccountId: null },
      { id: 'early', accountId: 'a', date: '2026-01-02', payee: '', categoryId: null, memo: '', amount: 2000, transferAccountId: null },
      { id: 'move', accountId: 'a', date: '2026-01-05', payee: '', categoryId: null, memo: '', amount: -3000, transferAccountId: 'b' },
    ],
  };
  const a = runningBalances(state, 'a');
  assert.deepEqual([a.get('early'), a.get('move'), a.get('late')], [12000, 9000, 8500]);
  assert.equal(a.get('late'), accountBalance(state, 'a'));
  const b = runningBalances(state, 'b');
  assert.deepEqual([...b.entries()], [['move', 3000]]);
});
