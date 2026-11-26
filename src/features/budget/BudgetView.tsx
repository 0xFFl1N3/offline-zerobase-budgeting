import { useState } from 'react';
import { categoryActivity, categoryAssigned, categoryAvailable, readyToAssign } from '../../engine/budget.ts';
import { formatMoney } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { Cents } from '../../engine/types.ts';
import { InlineAdd } from '../../components/InlineAdd.tsx';
import { MoneyField } from '../../components/MoneyField.tsx';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { GoalEditor } from './GoalEditor.tsx';
import { NameCell } from './NameCell.tsx';
import { GoalProgress } from './GoalProgress.tsx';

const COLUMNS = 'grid grid-cols-[1fr_8rem_8rem_8rem] items-center gap-2';

function ReadyToAssignPill({ amount, currency }: { amount: Cents; currency: 'EUR' | 'USD' }) {
  const tone =
    amount === 0
      ? 'bg-emerald-100 text-emerald-800'
      : amount > 0
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  const hint = amount === 0 ? 'Every euro has a job' : amount > 0 ? 'left to assign' : 'over-assigned';
  return (
    <div className={`rounded-full px-4 py-2 text-sm font-medium ${tone}`}>
      Ready to Assign: <span className="tabular-nums">{formatMoney(amount, currency)}</span>
      <span className="ml-2 font-normal">{hint}</span>
    </div>
  );
}

const availableTone = (cents: Cents) =>
  cents < 0 ? 'text-red-600 font-medium' : cents === 0 ? 'text-slate-400' : 'text-emerald-700';

export function BudgetView() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const month = useBudgetStore((s) => s.month);
  const shiftMonth = useBudgetStore((s) => s.shiftMonth);
  const assign = useBudgetStore((s) => s.assign);
  const addGroup = useBudgetStore((s) => s.addGroup);
  const addCategory = useBudgetStore((s) => s.addCategory);

  const renameGroup = useBudgetStore((s) => s.renameGroup);
  const renameCategory = useBudgetStore((s) => s.renameCategory);
  const deleteCategory = useBudgetStore((s) => s.deleteCategory);
  const deleteGroup = useBudgetStore((s) => s.deleteGroup);
  const archiveCategory = useBudgetStore((s) => s.archiveCategory);
  const archiveGroup = useBudgetStore((s) => s.archiveGroup);
  const restoreCategory = useBudgetStore((s) => s.restoreCategory);
  const restoreGroup = useBudgetStore((s) => s.restoreGroup);
  const [showArchived, setShowArchived] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const hasTransactions = (ids: string[]) => state.transactions.some((t) => t.categoryId !== null && ids.includes(t.categoryId));
  const fmt = (c: Cents) => formatMoney(c, currency);

  /**
   * Deletes a category or group, or archives it when it has transactions: past spending keeps its category,
   * and archiving frees the remaining balance for Ready to Assign.
   */
  const removeOrArchive = (label: string, ids: string[], doDelete: () => void, doArchive: () => void) => {
    const hasGoal = state.goals.some((g) => ids.includes(g.categoryId));
    if (!hasTransactions(ids)) {
      const assigned = state.monthlyBudgets.filter((b) => ids.includes(b.categoryId)).reduce((t, b) => t + b.assigned, 0);
      const lines = [`Delete ${label}?`];
      if (assigned !== 0) lines.push(`${fmt(assigned)} assigned to it returns to Ready to Assign.`);
      if (hasGoal) lines.push('Its goal is removed.');
      if (window.confirm(lines.join('\n\n'))) doDelete();
      return;
    }
    const balance = ids.reduce((t, id) => t + categoryAvailable(state, id, '9999-12'), 0);
    const lines = [
      `Archive ${label}?`,
      'It has transactions, so it cannot be deleted. Archiving hides it from the budget and from new transactions; past transactions and charts keep it.',
    ];
    if (balance !== 0) lines.push(`Its remaining balance of ${fmt(balance)} ${balance > 0 ? 'returns to' : 'is taken from'} Ready to Assign.`);
    lines.push('You can restore it from the Archived list at the bottom.');
    if (window.confirm(lines.join('\n\n'))) doArchive();
  };

  const archivedGroups = state.groups.filter((g) => g.archived);
  const archivedCategories = state.categories.filter((c) => c.archived && !archivedGroups.some((g) => g.id === c.groupId));
  const archivedCount = archivedGroups.length + archivedCategories.length;
  const rta = readyToAssign(state, month);
  const groups = state.groups.filter((g) => !g.archived);

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="rounded px-2 py-1 hover:bg-slate-200">
            ‹
          </button>
          <h2 className="min-w-44 text-center text-lg font-semibold">{formatMonth(month)}</h2>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="rounded px-2 py-1 hover:bg-slate-200">
            ›
          </button>
        </div>
        <ReadyToAssignPill amount={rta} currency={currency} />
      </div>

      <div className="mt-6 rounded-lg bg-white shadow-sm">
        <div className={`${COLUMNS} border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
          <span>Category</span>
          <span className="text-right">Assigned</span>
          <span className="text-right">Activity</span>
          <span className="text-right">Available</span>
        </div>

        {groups.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            No categories yet. Add a group such as "Living", then add categories like Rent or Electricity to it.
          </p>
        )}

        {groups.map((group) => {
          const cats = state.categories.filter((c) => c.groupId === group.id && !c.archived);
          const sum = (f: (id: string) => Cents) => cats.reduce((t, c) => t + f(c.id), 0);
          return (
            <div key={group.id} className="border-b border-slate-100 last:border-b-0">
              <div className={`${COLUMNS} bg-slate-50 px-4 py-2 text-sm font-semibold`}>
                <NameCell
                  name={group.name}
                  renaming={renaming === group.id}
                  onStartRename={() => setRenaming(group.id)}
                  onRename={(name) => {
                    void renameGroup(group.id, name);
                    setRenaming(null);
                  }}
                  onCancelRename={() => setRenaming(null)}
                  actionLabel={hasTransactions(cats.map((c) => c.id)) ? 'Archive' : 'Delete'}
                  onAction={() =>
                    removeOrArchive(
                      `the group "${group.name}" and its ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}`,
                      cats.map((c) => c.id),
                      () => void deleteGroup(group.id),
                      () => void archiveGroup(group.id),
                    )
                  }
                />
                <span className="px-2 text-right tabular-nums">{formatMoney(sum((id) => categoryAssigned(state, id, month)), currency)}</span>
                <span className="px-2 text-right tabular-nums">{formatMoney(sum((id) => categoryActivity(state, id, month)), currency)}</span>
                <span className="px-2 text-right tabular-nums">{formatMoney(sum((id) => categoryAvailable(state, id, month)), currency)}</span>
              </div>
              {cats.map((cat) => {
                const available = categoryAvailable(state, cat.id, month);
                const goal = state.goals.find((g) => g.categoryId === cat.id);
                return (
                  <div key={cat.id}>
                  <div className={`${COLUMNS} px-4 py-1 text-sm`}>
                    <div className="pl-4">
                      <NameCell
                        name={cat.name}
                        renaming={renaming === cat.id}
                        onStartRename={() => setRenaming(cat.id)}
                        onRename={(name) => {
                          void renameCategory(cat.id, name);
                          setRenaming(null);
                        }}
                        onCancelRename={() => setRenaming(null)}
                        actionLabel={hasTransactions([cat.id]) ? 'Archive' : 'Delete'}
                        onAction={() =>
                          removeOrArchive(`the category "${cat.name}"`, [cat.id], () => void deleteCategory(cat.id), () => void archiveCategory(cat.id))
                        }
                      />
                      {goal ? (
                        <button type="button" aria-label={`Edit goal for ${cat.name}`} onClick={() => setEditingGoal(cat.id)} className="block w-full text-left">
                          <GoalProgress state={state} goal={goal} month={month} currency={currency} />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setEditingGoal(cat.id)} className="text-xs text-sky-700 hover:underline">
                          Set goal
                        </button>
                      )}
                    </div>
                    <MoneyField
                      ariaLabel={`Assigned to ${cat.name}`}
                      value={categoryAssigned(state, cat.id, month)}
                      onCommit={(cents) => void assign(cat.id, cents)}
                    />
                    <span className="px-2 text-right tabular-nums text-slate-600">
                      {formatMoney(categoryActivity(state, cat.id, month), currency)}
                    </span>
                    <span className={`px-2 text-right tabular-nums ${availableTone(available)}`}>
                      {formatMoney(available, currency)}
                    </span>
                  </div>
                  {editingGoal === cat.id && <GoalEditor category={cat} goal={goal} onClose={() => setEditingGoal(null)} />}
                  </div>
                );
              })}
              <div className="px-8 py-2">
                <InlineAdd label="Add category" placeholder="Category name" onAdd={(name) => void addCategory(group.id, name)} />
              </div>
            </div>
          );
        })}

        <div className="border-t border-slate-200 px-4 py-3">
          <InlineAdd label="Add group" placeholder="Group name" onAdd={(name) => void addGroup(name)} />
        </div>

        {archivedCount > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 text-sm">
            <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived} className="text-slate-600 hover:underline">
              {showArchived ? '▾' : '▸'} Archived ({archivedCount})
            </button>
            {showArchived && (
              <ul className="mt-2 space-y-1">
                {archivedGroups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-4">
                    <span>
                      {g.name} <span className="text-slate-500">(group, {state.categories.filter((c) => c.groupId === g.id).length} categories)</span>
                    </span>
                    <button type="button" onClick={() => void restoreGroup(g.id)} className="text-sky-700 hover:underline">Restore</button>
                  </li>
                ))}
                {archivedCategories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4">
                    <span>
                      <span className="text-slate-500">{state.groups.find((g) => g.id === c.groupId)?.name} › </span>
                      {c.name}
                    </span>
                    <button type="button" onClick={() => void restoreCategory(c.id)} className="text-sky-700 hover:underline">Restore</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
