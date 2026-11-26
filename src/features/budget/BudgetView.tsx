import { useState, type ReactNode } from 'react';
import { touchesCategory, categoryActivity, categoryAssigned, categoryAvailable, readyToAssign } from '../../engine/budget.ts';
import { autoAssignPlan } from '../../engine/autoassign.ts';
import { formatMoney } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { Cents } from '../../engine/types.ts';
import { InlineAdd } from '../../components/InlineAdd.tsx';
import { MoveButtons, useReorder } from '../../components/reorder.tsx';
import { MoneyField } from '../../components/MoneyField.tsx';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { GoalEditor } from './GoalEditor.tsx';
import { NameCell } from './NameCell.tsx';
import { GoalProgress } from './GoalProgress.tsx';

/** The desktop table layout; phones get MobileGroupRow and MobileCategoryRow instead. */
const COLUMNS = 'hidden md:grid md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6.5rem] lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem] items-center gap-2';

function ReadyToAssignPill({ amount, currency, className = '' }: { amount: Cents; currency: 'EUR' | 'USD'; className?: string }) {
  const tone =
    amount === 0
      ? 'bg-emerald-100 text-emerald-800'
      : amount > 0
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  const hint = amount === 0 ? 'Every euro has a job' : amount > 0 ? 'left to assign' : 'over-assigned';
  return (
    <div className={`rounded-full px-4 py-2 text-sm font-medium ${tone} ${className}`}>
      Ready to Assign: <span className="tabular-nums">{formatMoney(amount, currency)}</span>
      <span className="ml-2 hidden font-normal sm:inline">{hint}</span>
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
  const moveGroup = useBudgetStore((s) => s.moveGroup);
  const moveCategory = useBudgetStore((s) => s.moveCategory);
  const moveGroupTo = useBudgetStore((s) => s.moveGroupTo);
  const moveCategoryTo = useBudgetStore((s) => s.moveCategoryTo);
  const groupDnd = useReorder((id, target, place) => void moveGroupTo(id, target, place), (id, d) => void moveGroup(id, d));
  const categoryDnd = useReorder((id, target, place) => void moveCategoryTo(id, target, place), (id, d) => void moveCategory(id, d));
  const archiveCategory = useBudgetStore((s) => s.archiveCategory);
  const archiveGroup = useBudgetStore((s) => s.archiveGroup);
  const restoreCategory = useBudgetStore((s) => s.restoreCategory);
  const restoreGroup = useBudgetStore((s) => s.restoreGroup);
  const [showArchived, setShowArchived] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [autoMessage, setAutoMessage] = useState<{ month: string; text: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  /** On phones: the group or category whose details and actions are open. */
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  /** On phones: up/down buttons instead of amounts, since dragging needs a mouse. */
  const [reordering, setReordering] = useState(false);

  const hasTransactions = (ids: string[]) =>
    state.transactions.some((t) => touchesCategory(t, ids)) || state.recurring.some((r) => touchesCategory(r.template, ids));
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
  const plan = autoAssignPlan(state, month);
  const autoAssign = useBudgetStore((s) => s.autoAssign);
  const runAutoAssign = async () => {
    if (plan.readyAfter < 0 && !window.confirm(`Funding every goal needs ${fmt(plan.total)}, which is ${fmt(-plan.readyAfter)} more than you have left to assign. Ready to Assign will go negative. Continue?`)) return;
    const n = await autoAssign();
    setAutoMessage({ month, text: `Assigned ${fmt(plan.total)} to ${n} categor${n === 1 ? 'y' : 'ies'}.` });
  };
  const groups = state.groups.filter((g) => !g.archived);

  return (
    <section className="p-3 md:p-6">
      {/* On phones this bar stays pinned under the top bar while the categories scroll. */}
      <div className="sticky top-14 z-10 -mx-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-3 py-2 md:static md:mx-0 md:border-0 md:p-0">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="rounded px-3 py-1.5 hover:bg-slate-200 md:px-2 md:py-1">
            ‹
          </button>
          <h2 className="min-w-36 text-center text-lg font-semibold md:min-w-44">{formatMonth(month)}</h2>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="rounded px-3 py-1.5 hover:bg-slate-200 md:px-2 md:py-1">
            ›
          </button>
        </div>
        {/* "contents": on phones the button sits next to the month and the pill gets its own full-width line. */}
        <div className="contents md:flex md:items-center md:gap-3">
          <button
            type="button"
            onClick={() => void runAutoAssign()}
            disabled={plan.steps.length === 0}
            title={plan.steps.length === 0 ? 'Every goal is already funded this month' : `Adds ${fmt(plan.total)} to ${plan.steps.length} categories so their goals are met`}
            className="ml-auto rounded border border-sky-600 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-default disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            Auto-assign{plan.total > 0 && <span className="ml-1 hidden tabular-nums sm:inline">{fmt(plan.total)}</span>}
          </button>
          <ReadyToAssignPill amount={rta} currency={currency} className="w-full text-center md:w-auto" />
        </div>
      </div>

      {autoMessage?.month === month && <p className="mt-3 text-sm text-emerald-700" role="status">{autoMessage.text}</p>}

      <div className="mt-3 rounded-lg bg-white shadow-sm md:mt-6">
        <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">
          <span>Category</span>
          <button
            type="button"
            onClick={() => {
              setReordering((v) => !v);
              setOpen(null);
            }}
            className={`ml-auto rounded px-2 py-1 normal-case tracking-normal ${reordering ? 'bg-sky-600 text-white' : 'text-sky-700'}`}
          >
            {reordering ? 'Done' : 'Reorder'}
          </button>
          {!reordering && <span>Available</span>}
        </div>
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

        {groups.map((group, groupIndex) => {
          const cats = state.categories.filter((c) => c.groupId === group.id && !c.archived);
          const sum = (f: (id: string) => Cents) => cats.reduce((t, c) => t + f(c.id), 0);
          return (
            <div key={group.id} className="border-b border-slate-100 last:border-b-0">
              <MobileGroupRow
                move={reordering ? <MoveButtons label={group.name} first={groupIndex === 0} last={groupIndex === groups.length - 1} onStep={(d) => void moveGroup(group.id, d)} /> : null}
                name={group.name}
                available={sum((id) => categoryAvailable(state, id, month))}
                fmt={fmt}
                open={open === group.id}
                onToggle={() => toggle(group.id)}
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
              <div {...groupDnd.rowProps(group.id, 'groups')} className={`${COLUMNS} bg-slate-50 px-4 py-2 text-sm font-semibold`}>
                <NameCell
                  name={group.name}
                  renaming={renaming === group.id}
                  onStartRename={() => setRenaming(group.id)}
                  onRename={(name) => {
                    void renameGroup(group.id, name);
                    setRenaming(null);
                  }}
                  onCancelRename={() => setRenaming(null)}
                  handle={groupDnd.handle(group.id, group.name, 'groups')}
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
              {cats.map((cat, catIndex) => {
                const available = categoryAvailable(state, cat.id, month);
                const goal = state.goals.find((g) => g.categoryId === cat.id);
                return (
                  <div key={cat.id}>
                  <MobileCategoryRow
                    move={reordering ? <MoveButtons label={cat.name} first={catIndex === 0} last={catIndex === cats.length - 1} onStep={(d) => void moveCategory(cat.id, d)} /> : null}
                    name={cat.name}
                    available={available}
                    activity={categoryActivity(state, cat.id, month)}
                    assigned={categoryAssigned(state, cat.id, month)}
                    onAssign={(cents) => void assign(cat.id, cents)}
                    fmt={fmt}
                    goal={goal ? <GoalProgress state={state} goal={goal} month={month} currency={currency} /> : null}
                    hasGoal={goal !== undefined}
                    onEditGoal={() => setEditingGoal(cat.id)}
                    open={open === cat.id}
                    onToggle={() => toggle(cat.id)}
                    renaming={renaming === cat.id}
                    onStartRename={() => setRenaming(cat.id)}
                    onRename={(name) => {
                      void renameCategory(cat.id, name);
                      setRenaming(null);
                    }}
                    onCancelRename={() => setRenaming(null)}
                    actionLabel={hasTransactions([cat.id]) ? 'Archive' : 'Delete'}
                    onAction={() => removeOrArchive(`the category "${cat.name}"`, [cat.id], () => void deleteCategory(cat.id), () => void archiveCategory(cat.id))}
                  />
                  <div {...categoryDnd.rowProps(cat.id, group.id)} className={`${COLUMNS} px-4 py-1 text-sm`}>
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
                        handle={categoryDnd.handle(cat.id, cat.name, group.id)}
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
              <div className="px-3 py-2 md:px-8">
                <InlineAdd label="Add category" placeholder="Category name" onAdd={(name) => void addCategory(group.id, name)} />
              </div>
            </div>
          );
        })}

        <div className="border-t border-slate-200 px-3 py-3 md:px-4">
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

const rowButton = 'flex w-full items-center gap-3 text-left';
const actionLink = 'rounded px-2 py-1.5 text-sm text-sky-700 hover:bg-sky-50';

interface RowActions {
  /** Up/down buttons while reordering; the row then shows only its name and these. */
  move: ReactNode;
  open: boolean;
  onToggle: () => void;
  renaming: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  actionLabel: string;
  onAction: () => void;
}

/** A rename box in place of the name, as on desktop (Enter saves, Escape or leaving cancels). */
function RenameInput({ name, onRename, onCancelRename }: { name: string; onRename: (name: string) => void; onCancelRename: () => void }) {
  return (
    <input
      autoFocus
      defaultValue={name}
      aria-label={`Rename ${name}`}
      enterKeyHint="done"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={onCancelRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.currentTarget.value.trim()) onRename(e.currentTarget.value);
        if (e.key === 'Escape') onCancelRename();
      }}
      className="w-full rounded border border-sky-500 px-2 py-1.5 text-base font-normal focus:outline-none"
    />
  );
}

/** Phone layout of a group heading: tap it for Rename and Archive/Delete. */
function MobileGroupRow({ name, available, fmt, ...a }: RowActions & { name: string; available: Cents; fmt: (c: Cents) => string }) {
  return (
    <div className="bg-slate-50 md:hidden">
      <div className="px-3 py-2.5 text-sm font-semibold">
        {a.move ? (
          <span className={rowButton}>
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {a.move}
          </span>
        ) : a.renaming ? (
          <RenameInput name={name} onRename={a.onRename} onCancelRename={a.onCancelRename} />
        ) : (
          <button type="button" onClick={a.onToggle} aria-expanded={a.open} className={rowButton}>
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <span className="tabular-nums">{fmt(available)}</span>
          </button>
        )}
      </div>
      {a.open && !a.renaming && !a.move && (
        <div className="flex gap-2 px-1 pb-2">
          <button type="button" onClick={a.onStartRename} className={actionLink}>Rename</button>
          <button type="button" onClick={a.onAction} className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">{a.actionLabel} group</button>
        </div>
      )}
    </div>
  );
}

interface CategoryRowProps extends RowActions {
  name: string;
  available: Cents;
  activity: Cents;
  assigned: Cents;
  onAssign: (cents: Cents) => void;
  fmt: (c: Cents) => string;
  goal: ReactNode;
  hasGoal: boolean;
  onEditGoal: () => void;
}

/** Phone layout of a category: name, goal and Available; tap it to assign money and for the other actions. */
function MobileCategoryRow({ name, available, activity, assigned, onAssign, fmt, goal, hasGoal, onEditGoal, ...a }: CategoryRowProps) {
  const pill = available < 0 ? 'bg-red-100 text-red-800' : available === 0 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-800';
  return (
    <div className={`border-t border-slate-100 md:hidden ${a.open ? 'bg-slate-50' : ''}`}>
      <div className="px-3 py-2.5 text-sm">
        {a.move ? (
          <span className={rowButton}>
            <span className="min-w-0 flex-1 truncate pl-3">{name}</span>
            {a.move}
          </span>
        ) : a.renaming ? (
          <RenameInput name={name} onRename={a.onRename} onCancelRename={a.onCancelRename} />
        ) : (
          <button type="button" onClick={a.onToggle} aria-expanded={a.open} className={rowButton}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{name}</span>
              {goal}
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums ${pill}`}>{fmt(available)}</span>
          </button>
        )}
      </div>
      {a.open && !a.renaming && !a.move && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Assigned</span>
              <MoneyField ariaLabel={`Assigned to ${name}`} value={assigned} onCommit={onAssign} boxed className="w-32 text-base" />
            </label>
            <span className="ml-auto text-right text-slate-600">
              Activity <span className="block tabular-nums text-slate-900">{fmt(activity)}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" onClick={onEditGoal} className={actionLink}>{hasGoal ? 'Edit goal' : 'Set goal'}</button>
            <button type="button" onClick={a.onStartRename} className={actionLink}>Rename</button>
            <button type="button" onClick={a.onAction} className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">{a.actionLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
