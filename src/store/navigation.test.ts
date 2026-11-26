import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsAsDates, useNavigation } from './navigation.ts';

test('linking to Transactions switches the tab and hands over the filters once', () => {
  useNavigation.getState().showTransactions({ category: 'cat:x', ...monthsAsDates('2026-01', '2026-02') });
  assert.equal(useNavigation.getState().tab, 'transactions');
  assert.deepEqual(useNavigation.getState().takePendingFilters(), { accountId: 'all', category: 'cat:x', from: '2026-01-01', to: '2026-02-28', search: '' });
  assert.equal(useNavigation.getState().takePendingFilters(), null);
  assert.deepEqual(monthsAsDates('2024-02', '2024-02'), { from: '2024-02-01', to: '2024-02-29' });
});
