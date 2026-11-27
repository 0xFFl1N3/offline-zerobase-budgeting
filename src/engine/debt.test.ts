import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup, serializeBackup, createBackup } from '../db/backup.ts';
import { filterTransactions, NO_FILTERS } from '../features/transactions/filterTransactions.ts';
import { outflowAges } from './ageOfMoney.ts';
import { spendingReport } from './analytics.ts';
import { accountBalance, categoryAvailable, readyToAssign } from './budget.ts';
import { incomeVsSpending, netWorth, topPayees } from './reports.ts';
import type { BudgetState, Transaction } from './types.ts';

// Girokonto with 1000 €, a TV financing of 820 € owed, and a payment category for it.
const tx = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, accountId: 'giro', date, payee: '', categoryId: null, memo: '', amount, transferAccountId: null, ...extra,
});
const payment = (id: string, date: string, euros: number) =>
  tx(id, date, -euros * 100, { payee: 'TV Shop', transferAccountId: 'tv', categoryId: 'tvpay' });

const state = (transactions: Transaction[]): BudgetState => ({
  accounts: [
    { id: 'giro', name: 'Girokonto', type: 'checking', openingBalance: 100000, sortOrder: 0, closed: false },
    { id: 'tv', name: 'TV financing', type: 'debt', openingBalance: -82000, sortOrder: 1, closed: false, paymentCategoryId: 'tvpay', minimumPayment: 5000 },
  ],
  groups: [{ id: 'debts', name: 'Debt payments', sortOrder: 0, archived: false }],
  categories: [{ id: 'tvpay', groupId: 'debts', name: 'TV financing', sortOrder: 0, archived: false }],
  goals: [],
  monthlyBudgets: [{ categoryId: 'tvpay', month: '2026-03', assigned: 20000 }],
  transactions,
  recurring: [],
});

test('a debt is outside Ready to Assign; a payment is spending from its category', () => {
  const before = state([]);
  assert.equal(readyToAssign(before, '2026-03'), 100000 - 20000, 'only the Girokonto counts');

  const after = state([payment('p1', '2026-03-10', 200)]);
  assert.equal(accountBalance(after, 'giro'), 80000);
  assert.equal(accountBalance(after, 'tv'), -62000, '820 € owed, 200 € paid');
  assert.equal(categoryAvailable(after, 'tvpay', '2026-03'), 0, 'the assigned 200 € is spent');
  assert.equal(readyToAssign(after, '2026-03'), readyToAssign(before, '2026-03'), 'paying does not change Ready to Assign');
});

test('borrowed cash arriving from a debt is money to assign', () => {
  const s = state([tx('b', '2026-03-01', 80000, { accountId: 'tv', transferAccountId: 'giro', amount: -80000 })]);
  assert.equal(accountBalance(s, 'giro'), 180000);
  assert.equal(accountBalance(s, 'tv'), -162000);
  assert.equal(readyToAssign(s, '2026-03'), 180000 - 20000);
});

test('reports count payments as spending; net worth includes the debt', () => {
  const s = state([payment('p1', '2026-03-10', 200), tx('salary', '2026-03-01', 250000, { payee: 'Employer' })]);
  const [march] = incomeVsSpending(s, ['2026-03']);
  assert.deepEqual([march!.income, march!.spending], [250000, 20000]);
  const report = spendingReport(s, 'month', '2026-03', 'category');
  assert.equal(report.total, 20000);
  assert.equal(report.uncategorizedCount, 0);
  assert.deepEqual(topPayees(s, ['2026-03']).rows.map((r) => [r.label, r.amount]), [['TV Shop', 20000]]);
  // 1000 € + 2500 € − 820 € owed; the payment moves money between the two and changes nothing.
  assert.equal(netWorth(s, ['2026-03'])[0]!.value, 100000 + 250000 - 82000);
});

test('filters find payments by their category and as transfers', () => {
  const s = state([payment('p1', '2026-03-10', 200), tx('t2', '2026-03-11', -500, { transferAccountId: 'giro2' })]);
  const ids = (category: string) => filterTransactions(s, { ...NO_FILTERS, category }).map((t) => t.id);
  assert.deepEqual(ids('cat:tvpay'), ['p1']);
  assert.deepEqual(ids('group:debts'), ['p1']);
  assert.deepEqual(ids('transfers').sort(), ['p1', 't2']);
  assert.deepEqual(ids('uncategorised'), []);
});

test('age of money: payments are outflows, borrowed cash is an inflow, the debt itself is ignored', () => {
  const s = state([
    tx('in', '2026-01-01', 100000),
    payment('p1', '2026-01-31', 100),
    tx('raise', '2026-02-01', -2000, { accountId: 'tv' }),
    tx('borrow', '2026-02-10', -50000, { accountId: 'tv', transferAccountId: 'giro' }),
  ]);
  // Opening 1000 € dated Jan 1 → the payment on Jan 31 is 30 days old; the debt's own change and the
  // borrowed cash (an inflow) are not outflows.
  assert.deepEqual(outflowAges(s, '2026-12-31'), [30]);
});

test('backups keep debt accounts and refuse a category on any other transfer', () => {
  const s = state([payment('p1', '2026-03-10', 200)]);
  const back = parseBackup(serializeBackup(createBackup(s, 'EUR')));
  assert.ok(back.ok);
  assert.deepEqual(back.ok && back.backup.data.accounts[1], s.accounts[1]);

  const wrong = state([tx('w', '2026-03-10', -100, { accountId: 'tv', transferAccountId: 'giro', categoryId: 'tvpay' })]);
  const refused = parseBackup(serializeBackup(createBackup(wrong, 'EUR')));
  assert.equal(refused.ok, false);
});

test('only payments from a budget account to a debt carry a category', async () => {
  const { checkDebtRules } = await import('./debt.ts');
  const s = state([]);
  assert.doesNotThrow(() => checkDebtRules(s, { accountId: 'giro', transferAccountId: 'tv', categoryId: 'tvpay' }));
  assert.doesNotThrow(() => checkDebtRules(s, { accountId: 'tv', transferAccountId: 'giro', categoryId: null }), 'borrowed cash');
  assert.doesNotThrow(() => checkDebtRules(s, { accountId: 'tv', transferAccountId: null, categoryId: null }), 'raising the debt');
  assert.throws(() => checkDebtRules(s, { accountId: 'tv', transferAccountId: null, categoryId: 'tvpay' }), /budget account/);
  assert.throws(() => checkDebtRules(s, { accountId: 'tv', transferAccountId: 'giro', categoryId: 'tvpay' }), /payment/);
});
