import type { BudgetState, Transaction } from '../../engine/types.ts';
import { t as tr } from '../../i18n/i18n.ts';

/** What to show in a Category column: the category, the two accounts of a transfer, the parts of a split, or income. */
export function categoryLabel(state: BudgetState, t: Pick<Transaction, 'accountId' | 'transferAccountId' | 'splits' | 'categoryId' | 'amount'>): string {
  if (t.transferAccountId) {
    const from = state.accounts.find((a) => a.id === t.accountId)?.name ?? '?';
    const to = state.accounts.find((a) => a.id === t.transferAccountId)?.name ?? '?';
    return tr('label.transfer', { from, to });
  }
  if (t.splits && t.splits.length > 0) {
    const names = [...new Set(t.splits.map((p) => state.categories.find((c) => c.id === p.categoryId)?.name ?? tr('label.unknownCategory')))];
    return tr('label.split', { names: names.join(', ') });
  }
  if (t.categoryId) {
    const category = state.categories.find((c) => c.id === t.categoryId);
    if (!category) return tr('label.unknownCategory');
    const archived = category.archived || state.groups.find((g) => g.id === category.groupId)?.archived;
    return archived ? tr('label.archived', { name: category.name }) : category.name;
  }
  return t.amount > 0 ? tr('tx.income') : tr('tx.needsCategory');
}
