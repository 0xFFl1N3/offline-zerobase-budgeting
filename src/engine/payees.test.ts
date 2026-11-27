import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payeeKey, payeeMemory, rememberedCategory, suggestPayees } from './payees.ts';
import type { BudgetState, Transaction } from './types.ts';

let n = 0;
const tx = (payee: string, date: string, amount: number, categoryId: string | null, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, accountId: 'a', date, payee, categoryId, memo: '', amount, transferAccountId: null, ...extra,
});
const state = (transactions: Transaction[]): BudgetState => ({
  accounts: [{ id: 'a', name: 'Checking', type: 'checking', openingBalance: 0, sortOrder: 0, closed: false }],
  groups: [{ id: 'g', name: 'G', sortOrder: 0, archived: false }],
  categories: [
    { id: 'groc', groupId: 'g', name: 'Groceries', sortOrder: 0, archived: false },
    { id: 'eat', groupId: 'g', name: 'Eating out', sortOrder: 1, archived: false },
    { id: 'old', groupId: 'g', name: 'Old', sortOrder: 2, archived: true },
  ],
  goals: [], monthlyBudgets: [], recurring: [], transactions,
});

test('payees are the same regardless of case and spacing', () => {
  assert.equal(payeeKey('  REWE   Markt '), payeeKey('rewe markt'));
});

test('the memory keeps the last category, kind, spelling and how often a payee was used', () => {
  const m = payeeMemory(state([
    tx('rewe', '2026-01-02', -1000, 'eat'),
    tx('REWE', '2026-03-01', -2000, 'groc'),
    tx('Rewe', '2026-02-01', -500, 'eat'),
    tx('Employer', '2026-03-28', 260000, null),
  ]));
  assert.deepEqual(m.get('rewe'), { name: 'REWE', count: 3, lastDate: '2026-03-01', categoryId: 'groc', kind: 'outflow' });
  assert.equal(m.get('employer')!.kind, 'inflow');
});

test('transfers and empty payees are not remembered; a split remembers no category', () => {
  const m = payeeMemory(state([
    tx('Savings', '2026-01-28', -30000, null, { transferAccountId: 'b' }),
    tx('  ', '2026-01-03', -100, 'groc'),
    tx('Amazon', '2026-01-24', -5000, null, { splits: [{ categoryId: 'groc', amount: -2000 }, { categoryId: 'eat', amount: -3000 }] }),
  ]));
  assert.deepEqual([...m.keys()], ['amazon']);
  assert.equal(m.get('amazon')!.categoryId, null);
});

test('a remembered category that is archived or gone is not offered', () => {
  const s = state([tx('A', '2026-01-01', -1, 'old'), tx('B', '2026-01-01', -1, 'deleted'), tx('C', '2026-01-01', -1, 'groc')]);
  const m = payeeMemory(s);
  assert.equal(rememberedCategory(s, m.get('a')), null);
  assert.equal(rememberedCategory(s, m.get('b')), null);
  assert.equal(rememberedCategory(s, m.get('c')), 'groc');
});

test('suggestions: starting with the text first, then containing it, most used first', () => {
  const m = payeeMemory(state([
    tx('Aldi Süd', '2026-01-01', -1, 'groc'),
    tx('REWE', '2026-01-02', -1, 'groc'), tx('REWE', '2026-01-09', -1, 'groc'),
    tx('Reformhaus', '2026-01-03', -1, 'groc'),
    tx('Café Klatsch', '2026-01-04', -1, 'eat'),
  ]));
  assert.deepEqual(suggestPayees(m, 're').map((p) => p.name), ['REWE', 'Reformhaus']);
  assert.deepEqual(suggestPayees(m, 'a').map((p) => p.name), ['Aldi Süd', 'Café Klatsch', 'Reformhaus']);
  assert.deepEqual(suggestPayees(m, ''), []);
  assert.deepEqual(suggestPayees(m, 'rewe'), [], 'nothing to suggest when the name is complete');
  assert.equal(suggestPayees(m, 'e', 2).length, 2);
});
