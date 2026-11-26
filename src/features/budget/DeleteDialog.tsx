import { useState } from 'react';
import { formatMoney, type Currency } from '../../engine/money.ts';
import type { BudgetState } from '../../engine/types.ts';

interface Props {
  /** What is being deleted, e.g. `the category "Rent"`. */
  label: string;
  /** The categories that will be removed (one for a category, all of a group's for a group). */
  categoryIds: string[];
  state: BudgetState;
  currency: Currency;
  onConfirm: (moveTo: string | null) => void;
  onCancel: () => void;
}

export function DeleteDialog({ label, categoryIds, state, currency, onConfirm, onCancel }: Props) {
  const affected = new Set(categoryIds);
  const assigned = state.monthlyBudgets.filter((b) => affected.has(b.categoryId)).reduce((t, b) => t + b.assigned, 0);
  const transactions = state.transactions.filter((t) => t.categoryId !== null && affected.has(t.categoryId));
  const txTotal = transactions.reduce((t, x) => t + x.amount, 0);
  const hasGoal = state.goals.some((g) => affected.has(g.categoryId));

  const groups = state.groups
    .filter((g) => !g.archived)
    .map((g) => ({ group: g, categories: state.categories.filter((c) => c.groupId === g.id && !c.archived && !affected.has(c.id)) }))
    .filter((g) => g.categories.length > 0);
  const firstOption = groups[0]?.categories[0]?.id ?? '';
  const [moveTo, setMoveTo] = useState(firstOption);

  const needsTarget = transactions.length > 0;
  const blocked = needsTarget && firstOption === '';
  const fmt = (c: number) => formatMoney(c, currency);

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${label}`}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Delete {label}?</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {assigned !== 0 && <li>{fmt(assigned)} assigned to it returns to Ready to Assign.</li>}
          {hasGoal && <li>Its goal is removed.</li>}
          {needsTarget && (
            <li>
              {transactions.length} transaction{transactions.length === 1 ? '' : 's'} ({fmt(txTotal)} in total) will be moved to another category:
              {blocked ? (
                <span className="mt-1 block text-red-600">There is no other category to move them to. Create one first.</span>
              ) : (
                <select
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  aria-label="Move transactions to"
                  className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                >
                  {groups.map(({ group, categories }) => (
                    <optgroup key={group.id} label={group.name}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </li>
          )}
          {assigned === 0 && !hasGoal && !needsTarget && <li>Nothing else is affected.</li>}
        </ul>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => onConfirm(needsTarget ? moveTo : null)}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
