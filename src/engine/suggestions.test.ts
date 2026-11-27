import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alreadyInBudget, planSuggestions, suggestions } from './suggestions.ts';
import type { BudgetState } from './types.ts';

const empty = (): BudgetState => ({ accounts: [], groups: [], categories: [], goals: [], monthlyBudgets: [], recurring: [], transactions: [] });

test('both languages have the same groups, none empty, no name twice', () => {
  const en = suggestions('en');
  const de = suggestions('de');
  assert.deepEqual(en.map((g) => g.id), de.map((g) => g.id));
  for (const list of [en, de]) {
    for (const g of list) {
      assert.ok(g.categories.length > 0, g.id);
      assert.ok(g.categories.some((c) => c.usual), `${g.id} has a usual category`);
      const names = g.categories.map((c) => c.name.toLowerCase());
      assert.equal(new Set(names).size, names.length, `${g.id} has no doubles`);
    }
    assert.equal(new Set(list.map((g) => g.name)).size, list.length);
  }
  assert.ok(de[0]!.categories.some((c) => c.name === 'Rundfunkbeitrag'));
  assert.ok(!en[0]!.categories.some((c) => c.name === ''), 'left-out names are dropped');
});

test('the plan keeps the order, drops doubles and empty groups', () => {
  const plan = planSuggestions(empty(), [
    { group: 'Living', categories: ['Rent', 'Groceries', ' rent ', ''] },
    { group: 'Exercise', categories: [] },
    { group: 'Giving', categories: ['Birthdays'] },
  ]);
  assert.deepEqual(plan.groups, [
    { name: 'Living', existingId: null, categories: ['Rent', 'Groceries'] },
    { name: 'Giving', existingId: null, categories: ['Birthdays'] },
  ]);
});

test('an existing group gets only what it does not have yet', () => {
  const s = empty();
  s.groups.push({ id: 'g', name: 'living', sortOrder: 0, archived: false });
  s.categories.push({ id: 'c', groupId: 'g', name: 'Rent', sortOrder: 0, archived: false });
  const plan = planSuggestions(s, [{ group: 'Living', categories: ['Rent', 'Internet'] }]);
  assert.deepEqual(plan.groups, [{ name: 'living', existingId: 'g', categories: ['Internet'] }]);
  assert.equal(alreadyInBudget(s, 'Living', 'rent'), true);
  assert.equal(alreadyInBudget(s, 'Living', 'Internet'), false);
  assert.deepEqual(planSuggestions(s, [{ group: 'Living', categories: ['Rent'] }]).groups, [], 'nothing new: nothing to do');
});
