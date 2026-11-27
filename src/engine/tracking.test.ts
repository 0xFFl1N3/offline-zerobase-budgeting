import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountBalance, categoryAvailable, readyToAssign } from './budget.ts';
import { checkDebtRules, prepareTransaction, valueUpdate } from './debt.ts';
import { updateAccount } from './edit.ts';
import { reconcile } from './reconcile.ts';
import { incomeVsSpending, netWorth } from './reports.ts';
import { spendingReport } from './analytics.ts';
import { createBackup, parseBackup, serializeBackup } from '../db/backup.ts';
import type { BudgetState, Transaction } from './types.ts';

const M = '2026-11';
let n = 0;
const tx = (extra: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, accountId: 'giro', date: `${M}-10`, payee: 'x', categoryId: null, memo: '', amount: 0, transferAccountId: null, ...extra,
});
const state = (transactions: Transaction[] = []): BudgetState => ({
  accounts: [
    { id: 'giro', name: 'Girokonto', type: 'checking', openingBalance: 300000, sortOrder: 0, closed: false },
    { id: 'etf', name: 'ETF', type: 'tracking', openingBalance: 1000000, sortOrder: 1, closed: false },
  ],
  groups: [{ id: 'g', name: 'Sparen', sortOrder: 0, archived: false }],
  categories: [{ id: 'invest', groupId: 'g', name: 'ETF-Sparplan', sortOrder: 0, archived: false }],
  goals: [],
  monthlyBudgets: [{ categoryId: 'invest', month: M, assigned: 30000 }],
  recurring: [],
  transactions,
});
const save = (s: BudgetState, t: Transaction) => ({ ...s, transactions: [...s.transactions, prepareTransaction(s, t)] });

test('a tracking account is not in Ready to Assign but counts towards net worth', () => {
  const s = state();
  assert.equal(readyToAssign(s, M), 300000 - 30000);
  assert.equal(netWorth(s, [M])[0]!.value, 1300000);
});

test('money into a tracking account comes from a category, never straight from Ready to Assign', () => {
  const plan = tx({ amount: -30000, transferAccountId: 'etf', categoryId: 'invest', payee: 'ETF-Sparplan' });
  const s = save(state(), plan);
  assert.equal(categoryAvailable(s, 'invest', M), 0);
  assert.equal(readyToAssign(s, M), 270000, 'Ready to Assign does not change: the money was already planned');
  assert.equal(accountBalance(s, 'etf'), 1030000);
  assert.throws(() => prepareTransaction(state(), { ...plan, categoryId: null }), /tracking account needs the category/);
  const seenFromTheEtf = tx({ accountId: 'etf', amount: 30000, transferAccountId: 'giro' });
  assert.throws(() => prepareTransaction(state(), seenFromTheEtf), /tracking account needs the category/, 'the same move written the other way round');
});

test('money out of a tracking account into the budget is income to Ready to Assign', () => {
  const back = tx({ accountId: 'etf', amount: -50000, transferAccountId: 'giro' });
  const s = save(state(), back);
  assert.equal(readyToAssign(s, M), 270000 + 50000);
  assert.throws(() => checkDebtRules(state(), { ...back, categoryId: 'invest' }), /Only a payment/);
});

test('a change in value has no category, changes net worth, and is neither income nor uncategorized spending', () => {
  const gain = tx({ accountId: 'etf', amount: 12000, payee: 'Wertänderung' });
  const loss = tx({ accountId: 'etf', amount: -4000, payee: 'Wertänderung' });
  const s = save(save(state(), gain), loss);
  assert.equal(netWorth(s, [M])[0]!.value, 1308000);
  assert.equal(readyToAssign(s, M), 270000);
  assert.equal(incomeVsSpending(s, [M])[0]!.income, 0);
  assert.equal(spendingReport(s, 'month', M, 'category').uncategorizedCount, 0);
  assert.throws(() => checkDebtRules(s, { ...gain, categoryId: 'invest' }), /Spending from a category/);
});

test('reconciling a tracking account books the difference without a category', () => {
  const r = reconcile(state(), 'etf', 1050000, { today: `${M}-27`, adjustmentId: 'adj', categoryId: 'invest' });
  const adj = r.state.transactions.find((t) => t.id === 'adj')!;
  assert.deepEqual([adj.amount, adj.categoryId, adj.accountId], [50000, null, 'etf']);
});

test('a tracking account cannot become a budget account or a debt, and the other way round', () => {
  assert.throws(() => updateAccount(state(), 'etf', { type: 'checking' }), /cannot be changed/);
  assert.throws(() => updateAccount(state(), 'giro', { type: 'tracking' }), /cannot be changed/);
  assert.equal(updateAccount(state(), 'giro', { type: 'savings' }).accounts[0]!.type, 'savings');
});

test('a backup keeps tracking accounts', () => {
  const back = parseBackup(serializeBackup(createBackup(state(), 'EUR')));
  assert.ok(back.ok && back.backup.data.accounts[1]!.type === 'tracking');
});

test('fixed on the way: a debt correction is not income either', () => {
  const s: BudgetState = { ...state(), accounts: [...state().accounts, { id: 'loan', name: 'Loan', type: 'debt', openingBalance: -50000, sortOrder: 2, closed: false }] };
  const corrected = save(s, tx({ accountId: 'loan', amount: 10000, payee: 'Korrektur' }));
  const raised = save(s, tx({ accountId: 'loan', amount: -10000, payee: 'Erhöhung' }));
  assert.equal(incomeVsSpending(corrected, [M])[0]!.income, 0);
  assert.equal(spendingReport(raised, 'month', M, 'category').uncategorizedCount, 0);
});

test('updating the value books the difference to the new value', () => {
  const s = save(state(), valueUpdate('etf', 1000000, 1085000, `${M}-27`, 'Wertänderung', 'v'));
  assert.equal(accountBalance(s, 'etf'), 1085000);
  assert.equal(s.transactions[0]!.categoryId, null);
});
