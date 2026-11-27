import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryAvailable, monthSummary, readyToAssign } from './budget.ts';
import { buildDemo } from './demo.ts';
import { addMonths } from './months.ts';
import type { BudgetState } from './types.ts';

const months = (to: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(to, i - n + 1));

test('the parts always add up to Ready to Assign, in every month of the sample data', () => {
  for (const language of ['en', 'de'] as const) {
    const s = buildDemo('2026-11-27', language);
    for (const m of months('2027-01', 28)) {
      const sum = monthSummary(s, m);
      assert.equal(sum.readyToAssign, readyToAssign(s, m), m);
      assert.equal(sum.fromLastMonth + sum.overspentLastMonth + sum.income - sum.assigned, readyToAssign(s, m), m);
    }
  }
});

test('they still add up with an archived category, overspending and money moving out of a debt or investment', () => {
  const base = buildDemo('2026-11-27', 'en');
  // Archive the fuel category (it was overspent) and take money back out of the ETF into the checking account.
  const s: BudgetState = {
    ...base,
    categories: base.categories.map((c) => (c.id === 'cat-fuel' ? { ...c, archived: true } : c)),
    transactions: [
      ...base.transactions,
      { id: 'out', accountId: 'acc-etf', date: '2026-10-14', payee: 'Sale', categoryId: null, memo: '', amount: -50000, transferAccountId: 'acc-giro' },
    ],
  };
  for (const m of months('2026-12', 6)) assert.equal(monthSummary(s, m).readyToAssign, readyToAssign(s, m), m);
  assert.equal(monthSummary(s, '2026-10').income - monthSummary(base, '2026-10').income > 0, true, 'money back from the investment counts as income');
});

test('the category side matches the budget', () => {
  const s = buildDemo('2026-11-27', 'de');
  const sum = monthSummary(s, '2026-11');
  const total = s.categories.reduce((t, c) => t + categoryAvailable(s, c.id, '2026-11'), 0);
  assert.equal(sum.available, total);
  assert.ok(sum.spent < 0 && sum.assigned > 0 && sum.income > 0);
  assert.ok(monthSummary(s, '2026-11').overspentLastMonth <= 0);
});
