import { useCallback, useState, type ReactNode } from 'react';
import { accountBalance, availableToAssign, touchesCategory, categoryActivity, categoryAssigned, categoryAvailable } from '../../engine/budget.ts';
import { ASSIGN_KINDS, assignPlan, type AssignKind } from '../../engine/autoassign.ts';
import { AssignMenu } from './AssignMenu.tsx';
import { activeSeriesUsing } from '../../engine/recurring.ts';
import { formatMoney } from '../../engine/money.ts';
import { formatMonth, monthsBetween, toISODate } from '../../engine/months.ts';
import type { Cents } from '../../engine/types.ts';
import { InlineAdd } from '../../components/InlineAdd.tsx';
import { AddCategory } from './AddCategory.tsx';
import { MoveButtons, useReorder } from '../../components/reorder.tsx';
import { MoneyField } from '../../components/MoneyField.tsx';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { GoalEditor } from './GoalEditor.tsx';
import { debtForCategory, nextPaymentMonth, payoffForecast, plannedPayment } from '../../engine/debt.ts';
import { useNavigation } from '../../store/navigation.ts';
import { useAction } from '../errors/useAction.ts';
import { NameCell } from './NameCell.tsx';
import { DueGoalActions, GoalProgress } from './GoalProgress.tsx';
import { MonthOverview } from './MonthOverview.tsx';
import { useCollapsedGroups } from './collapsed.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';

/** The desktop table layout; phones get MobileGroupRow and MobileCategoryRow instead. */
const COLUMNS = 'hidden md:grid md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6.5rem] lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem] items-center gap-2';

/** Ready to Assign; a click opens the month overview, which explains the number. */
function ReadyToAssignPill({ amount, currency, onOpen, className = '' }: { amount: Cents; currency: 'EUR' | 'USD'; onOpen: () => void; className?: string }) {
  const tone =
    amount === 0
      ? 'bg-emerald-100 text-emerald-800'
      : amount > 0
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  const hint = t(amount === 0 ? 'budget.hintZero' : amount > 0 ? 'budget.hintLeft' : 'budget.hintOver');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      title={t('budget.openOverview')}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium hover:brightness-95 ${tone} ${className}`}
    >
      <span>
        {t('budget.readyToAssign')}: <span className="tabular-nums">{formatMoney(amount, currency)}</span>
        <span className="ml-2 hidden font-normal sm:inline">{hint}</span>
      </span>
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
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
  const { run } = useAction();
  const openDebt = useNavigation((s) => s.openDebt);

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
  /** The goal editor was opened from "New goal…" after a past due date. */
  const [freshGoal, setFreshGoal] = useState(false);
  const openGoal = (id: string, fresh = false) => {
    setFreshGoal(fresh);
    setEditingGoal(id);
  };
  const [autoMessage, setAutoMessage] = useState<{ month: string; text: string } | null>(null);
  const [overview, setOverview] = useState(false);
  const closeOverview = useCallback(() => setOverview(false), []);
  const [renaming, setRenaming] = useState<string | null>(null);
  /** On phones: the group or category whose details and actions are open. */
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  /** On phones: up/down buttons instead of amounts, since dragging needs a mouse. */
  const [reordering, setReordering] = useState(false);
  const folding = useCollapsedGroups();
  /** Categories ticked in the budget: Auto-assign then fills only these. Kept while moving between months. */
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const tick = (ids: string[], on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

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
      const lines = [t('budget.deleteQuestion', { label })];
      if (assigned !== 0) lines.push(t('budget.deleteAssigned', { amount: fmt(assigned) }));
      if (hasGoal) lines.push(t('budget.deleteGoal'));
      if (window.confirm(lines.join('\n\n'))) doDelete();
      return;
    }
    const balance = ids.reduce((t, id) => t + categoryAvailable(state, id, '9999-12'), 0);
    const lines = [t('budget.archiveQuestion', { label }), t('budget.archiveWhy')];
    if (balance !== 0) lines.push(t(balance > 0 ? 'budget.archiveReturns' : 'budget.archiveTaken', { amount: fmt(Math.abs(balance)) }));
    const series = activeSeriesUsing(state, { categoryIds: ids });
    if (series.length > 0) lines.push(t('budget.archivePauses', { count: series.length, names: series.map((r) => r.template.payee || t('recur.noPayee')).join(', ') }));
    lines.push(t('budget.archiveRestore'));
    if (window.confirm(lines.join('\n\n'))) doArchive();
  };

  const archivedGroups = state.groups.filter((g) => g.archived);
  const archivedCategories = state.categories.filter((c) => c.archived && !archivedGroups.some((g) => g.id === c.groupId));
  const archivedCount = archivedGroups.length + archivedCategories.length;
  // Today's month: from here on, money already assigned to later months is not free any more (see availableToAssign).
  const currentMonth = toISODate().slice(0, 7);
  const rta = availableToAssign(state, month, currentMonth);
  // Only ticks on categories still in the budget count (one may have been archived or deleted since).
  const activeGroupIds = new Set(state.groups.filter((g) => !g.archived).map((g) => g.id));
  const tickedIds = state.categories.filter((c) => !c.archived && activeGroupIds.has(c.groupId) && ticked.has(c.id)).map((c) => c.id);
  const only = tickedIds.length > 0 ? new Set(tickedIds) : undefined;
  const plans = Object.fromEntries(ASSIGN_KINDS.map((kind) => [kind, assignPlan(state, month, kind, currentMonth, only)])) as Record<AssignKind, ReturnType<typeof assignPlan>>;
  const autoAssign = useBudgetStore((s) => s.autoAssign);
  const runAutoAssign = async (kind: AssignKind) => {
    const plan = plans[kind];
    if (plan.readyAfter < 0 && !window.confirm(t('budget.autoAssignConfirm', { total: fmt(plan.total), over: fmt(-plan.readyAfter) }))) return;
    const n = await autoAssign(kind, only);
    setAutoMessage({ month, text: t('budget.autoAssignDone', { amount: fmt(plan.total), count: n }) });
  };
  const groups = state.groups.filter((g) => !g.archived);

  return (
    <section className="p-3 md:p-6">
      {/*
        * Wider screens: the month bar and the column labels stay at the top while the groups scroll under them.
        * Phones: "contents", so the month bar alone stays pinned under the top bar (its own sticky below).
        */}
      <div className="contents md:sticky md:top-0 md:z-10 md:-mx-6 md:-mt-6 md:block md:border-b md:border-slate-200 md:bg-slate-50 md:px-6 md:pt-6">
      {/* On phones this bar stays pinned under the top bar while the categories scroll. */}
      <div className="sticky top-14 z-10 -mx-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-3 py-2 md:static md:mx-0 md:border-0 md:p-0">
        <div className="flex items-center gap-2">
          <button type="button" aria-label={t('budget.prevMonth')} onClick={() => shiftMonth(-1)} className="rounded px-3 py-1.5 hover:bg-slate-200 md:px-2 md:py-1">
            ‹
          </button>
          <h2 className="min-w-36 text-center text-lg font-semibold md:min-w-44">{formatMonth(month)}</h2>
          <button type="button" aria-label={t('budget.nextMonth')} onClick={() => shiftMonth(1)} className="rounded px-3 py-1.5 hover:bg-slate-200 md:px-2 md:py-1">
            ›
          </button>
          {/* Only away from the current month: one click back to it. */}
          {month !== currentMonth && (
            <button
              type="button"
              onClick={() => shiftMonth(monthsBetween(month, currentMonth))}
              title={t('budget.thisMonthTitle', { month: formatMonth(currentMonth) })}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-slate-100"
            >
              {t('budget.thisMonth')}
            </button>
          )}
        </div>
        {/* "contents": on phones the button sits next to the month and the pill gets its own full-width line. */}
        <div className="contents md:flex md:items-center md:gap-3">
          <AssignMenu plans={plans} format={fmt} onPick={(kind) => void runAutoAssign(kind)} tickedCount={tickedIds.length} onClearTicks={() => setTicked(new Set())} />
          <ReadyToAssignPill amount={rta} currency={currency} onOpen={() => setOverview(true)} className="w-full text-center md:w-auto" />
        </div>
      </div>

      {overview && (
        <MonthOverview
          state={state}
          month={month}
          currentMonth={currentMonth}
          currency={currency}
          goalsNeed={plans.goals.total}
          onFundGoals={() => void runAutoAssign('goals')}
          onClose={closeOverview}
        />
      )}
      {autoMessage?.month === month && <p className="mt-3 text-sm text-emerald-700" role="status">{autoMessage.text}</p>}
        {/* The column labels, above the groups. */}
        <div className={`${COLUMNS} mt-4 px-4 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500`}>
          {/* The names need no heading: groups and categories speak for themselves. */}
          <span />
          <span className="text-right">{t('budget.colAssigned')}</span>
          <span className="text-right">{t('budget.colActivity')}</span>
          <span className="text-right">{t('budget.colAvailable')}</span>
        </div>
      </div>

      {/* Each group is a card of its own; the column labels sit above them as plain text. */}
      <div className="mt-3 md:mt-4">
        <div className="flex items-center gap-3 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">
          <button
            type="button"
            onClick={() => {
              setReordering((v) => !v);
              setOpen(null);
            }}
            className={`ml-auto rounded px-2 py-1 normal-case tracking-normal ${reordering ? 'bg-sky-600 text-white' : 'text-sky-700'}`}
          >
            {reordering ? t('common.done') : t('budget.reorder')}
          </button>
          {!reordering && <span>{t('budget.colAvailable')}</span>}
        </div>

        {groups.length === 0 && (
          <p className="rounded-lg bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
            {t('budget.empty')}
          </p>
        )}

        {groups.map((group, groupIndex) => {
          const cats = state.categories.filter((c) => c.groupId === group.id && !c.archived);
          const sum = (f: (id: string) => Cents) => cats.reduce((t, c) => t + f(c.id), 0);
          const collapsed = folding.isCollapsed(group.id);
          return (
            // The whole card is the drop target for moving groups, so the drop line falls between cards.
            <section key={group.id} aria-label={group.name} {...groupDnd.rowProps(group.id, 'groups', true)} className="mb-4 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <MobileGroupRow
                fold={<FoldButton name={group.name} collapsed={collapsed} onToggle={() => folding.toggle(group.id)} />}
                collapsed={collapsed}
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
                actionLabel={hasTransactions(cats.map((c) => c.id)) ? t('budget.archiveGroup') : t('budget.deleteGroup')}
                onAction={() =>
                  removeOrArchive(
                    t('budget.groupLabel', { name: group.name, count: cats.length }),
                    cats.map((c) => c.id),
                    () => void deleteGroup(group.id),
                    () => void archiveGroup(group.id),
                  )
                }
              />
              <div className={`${COLUMNS} ${collapsed ? '' : 'border-b border-slate-200'} px-4 py-3 text-base font-semibold`}>
                <span className="flex min-w-0 items-center gap-1">
                <FoldButton name={group.name} collapsed={collapsed} onToggle={() => folding.toggle(group.id)} />
                <Tick
                  label={t('budget.selectGroup', { name: group.name })}
                  checked={cats.length > 0 && cats.every((c) => ticked.has(c.id))}
                  mixed={cats.some((c) => ticked.has(c.id)) && !cats.every((c) => ticked.has(c.id))}
                  disabled={cats.length === 0}
                  onChange={(on) => tick(cats.map((c) => c.id), on)}
                />
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
                  actionLabel={hasTransactions(cats.map((c) => c.id)) ? t('budget.archive') : t('common.delete')}
                  onAction={() =>
                    removeOrArchive(
                      t('budget.groupLabel', { name: group.name, count: cats.length }),
                      cats.map((c) => c.id),
                      () => void deleteGroup(group.id),
                      () => void archiveGroup(group.id),
                    )
                  }
                />
                </span>
                <span className="px-2 text-right text-sm font-medium tabular-nums text-slate-600">{formatMoney(sum((id) => categoryAssigned(state, id, month)), currency)}</span>
                <span className="px-2 text-right text-sm font-medium tabular-nums text-slate-600">{formatMoney(sum((id) => categoryActivity(state, id, month)), currency)}</span>
                <span className="px-2 text-right text-sm font-semibold tabular-nums">{formatMoney(sum((id) => categoryAvailable(state, id, month)), currency)}</span>
              </div>
              {!collapsed && (<>
              <div className="divide-y divide-slate-100">
              {cats.map((cat, catIndex) => {
                const available = categoryAvailable(state, cat.id, month);
                const goal = state.goals.find((g) => g.categoryId === cat.id);
                const debt = debtForCategory(state, cat.id);
                // "€620.00 left · paid off April 2028", opening the payoff plan.
                const debtLine = (() => {
                  if (!debt) return null;
                  const owed = -accountBalance(state, debt.id);
                  if (owed <= 0) return t('debt.paidOff');
                  const planned = plannedPayment(state, debt);
                  const f = planned ? payoffForecast(owed, planned, nextPaymentMonth(state, debt, toISODate())) : null;
                  return f ? t('debt.leftShort', { amount: fmt(owed), month: formatMonth(f.lastMonth) }) : t('debt.leftNoPlan', { amount: fmt(owed) });
                })();
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
                    onEditGoal={() => openGoal(cat.id)}
                    dueActions={goal ? <DueGoalActions state={state} goal={goal} month={month} onNewGoal={() => openGoal(cat.id, true)} /> : null}
                    onOpenDebt={debt ? () => openDebt(debt.id) : undefined}
                    debtLine={debtLine}
                    open={open === cat.id}
                    onToggle={() => toggle(cat.id)}
                    renaming={renaming === cat.id}
                    onStartRename={() => setRenaming(cat.id)}
                    onRename={(name) => {
                      void renameCategory(cat.id, name);
                      setRenaming(null);
                    }}
                    onCancelRename={() => setRenaming(null)}
                    actionLabel={hasTransactions([cat.id]) ? t('budget.archive') : t('common.delete')}
                    onAction={() => removeOrArchive(t('budget.categoryLabel', { name: cat.name }), [cat.id], () => void deleteCategory(cat.id), () => void archiveCategory(cat.id))}
                  />
                  <div {...categoryDnd.rowProps(cat.id, group.id)} className={`${COLUMNS} px-4 py-2 text-sm ${ticked.has(cat.id) ? 'bg-sky-50' : ''}`}>
                    {/* Lined up under the group: room for its arrow, then the tick box, then the name. */}
                    <div className="flex items-start gap-1">
                    <span className="w-7 shrink-0" />
                    <Tick label={t('budget.selectCategory', { name: cat.name })} checked={ticked.has(cat.id)} onChange={(on) => tick([cat.id], on)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
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
                        extraAction={goal ? undefined : { label: t('budget.setGoal'), onClick: () => openGoal(cat.id) }}
                        actionLabel={hasTransactions([cat.id]) ? t('budget.archive') : t('common.delete')}
                        onAction={() =>
                          removeOrArchive(t('budget.categoryLabel', { name: cat.name }), [cat.id], () => void deleteCategory(cat.id), () => void archiveCategory(cat.id))
                        }
                      />
                      {goal && (
                        <>
                          <button type="button" aria-label={t('budget.editGoalFor', { name: cat.name })} onClick={() => openGoal(cat.id)} className="block w-full text-left">
                            <GoalProgress state={state} goal={goal} month={month} currency={currency} />
                          </button>
                          <DueGoalActions state={state} goal={goal} month={month} onNewGoal={() => openGoal(cat.id, true)} className="-ml-1.5" />
                        </>
                      )}
                      {debt && (
                        <button type="button" onClick={() => openDebt(debt.id)} title={t('debt.planLink')} className="block text-xs text-slate-600 hover:text-sky-700 hover:underline">
                          {debtLine}
                        </button>
                      )}
                    </div>
                    </div>
                    <MoneyField
                      ariaLabel={t('budget.assignedTo', { name: cat.name })}
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
                  {editingGoal === cat.id && <GoalEditor key={String(freshGoal)} category={cat} goal={goal} fresh={freshGoal} onClose={() => setEditingGoal(null)} />}
                  </div>
                );
              })}
              </div>
              <div className="border-t border-slate-100 px-3 py-2 md:px-8">
                <AddCategory groupId={group.id} />
              </div>
              </>)}
            </section>
          );
        })}

        <div className="px-3 py-2 md:px-4">
          <InlineAdd label={t('budget.addGroup')} placeholder={t('budget.groupName')} onAdd={(name) => run(() => addGroup(name))} />
        </div>

        {archivedCount > 0 && (
          <div className="px-3 py-2 text-sm md:px-4">
            <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived} className="text-slate-600 hover:underline">
              {showArchived ? '▾' : '▸'} {t('budget.archived', { count: archivedCount })}
            </button>
            {showArchived && (
              <ul className="mt-2 space-y-1">
                {archivedGroups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-4">
                    <span>
                      {g.name} <span className="text-slate-500">{t('budget.archivedGroup', { count: state.categories.filter((c) => c.groupId === g.id).length })}</span>
                    </span>
                    <button type="button" onClick={() => void restoreGroup(g.id)} className="text-sky-700 hover:underline">{t('budget.restore')}</button>
                  </li>
                ))}
                {archivedCategories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4">
                    <span>
                      <span className="text-slate-500">{state.groups.find((g) => g.id === c.groupId)?.name} › </span>
                      {c.name}
                    </span>
                    <button type="button" onClick={() => void restoreCategory(c.id)} className="text-sky-700 hover:underline">{t('budget.restore')}</button>
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

/** A tick box in front of a group or category; ticked ones are what Auto-assign fills. */
function Tick({ label, checked, mixed = false, disabled = false, onChange, className = '' }: { label: string; checked: boolean; mixed?: boolean; disabled?: boolean; onChange: (on: boolean) => void; className?: string }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${className}`}>
      <input {...NO_AUTOFILL}
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        // "Some ticked" shows as a dash; a click then ticks all of them.
        ref={(el) => {
          if (el) el.indeterminate = mixed;
        }}
        onChange={(e) => onChange(mixed || e.target.checked)}
        className="tick"
      />
    </span>
  );
}

/** The arrow that folds a group away to its heading, or opens it again. */
function FoldButton({ name, collapsed, onToggle }: { name: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={t(collapsed ? 'budget.expandGroup' : 'budget.collapseGroup', { name })}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
    >
      <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
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
    <input {...NO_AUTOFILL}
      autoFocus
      defaultValue={name}
      aria-label={t('budget.renameName', { name })}
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
function MobileGroupRow({ name, available, fmt, fold, collapsed, ...a }: RowActions & { name: string; available: Cents; fmt: (c: Cents) => string; fold: ReactNode; collapsed: boolean }) {
  return (
    <div className={`md:hidden ${collapsed ? '' : 'border-b border-slate-200'}`}>
      <div className="flex items-center gap-1 py-3 pl-1 pr-3 text-base font-semibold">
        {fold}
        <div className="min-w-0 flex-1">
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
      </div>
      {a.open && !a.renaming && !a.move && (
        <div className="flex gap-2 px-1 pb-2">
          <button type="button" onClick={a.onStartRename} className={actionLink}>{t('common.rename')}</button>
          <button type="button" onClick={a.onAction} className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">{a.actionLabel}</button>
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
  /** What to do with a goal whose due month has passed (empty otherwise). */
  dueActions?: ReactNode;
  /** For a debt's payment category. */
  onOpenDebt?: () => void;
  debtLine?: string | null;
}

/** Phone layout of a category: name, goal and Available; tap it to assign money and for the other actions. */
function MobileCategoryRow({ name, available, activity, assigned, onAssign, fmt, goal, hasGoal, onEditGoal, dueActions, onOpenDebt, debtLine, ...a }: CategoryRowProps) {
  const pill = available < 0 ? 'bg-red-100 text-red-800' : available === 0 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-800';
  return (
    <div className={`md:hidden ${a.open ? 'bg-slate-50' : ''}`}>
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
              {debtLine && <span className="block text-xs text-slate-500">{debtLine}</span>}
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums ${pill}`}>{fmt(available)}</span>
          </button>
        )}
      </div>
      {a.open && !a.renaming && !a.move && (
        <div className="px-3 pb-3">
          {dueActions && <div className="mb-2 -ml-1.5">{dueActions}</div>}
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-slate-600">{t('budget.colAssigned')}</span>
              <MoneyField ariaLabel={t('budget.assignedTo', { name })} value={assigned} onCommit={onAssign} boxed className="w-32 text-base" />
            </label>
            <span className="ml-auto text-right text-slate-600">
              {t('budget.colActivity')} <span className="block tabular-nums text-slate-900">{fmt(activity)}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {onOpenDebt && <button type="button" onClick={onOpenDebt} className={actionLink}>{t('debt.planLink')}</button>}
            <button type="button" onClick={onEditGoal} className={actionLink}>{hasGoal ? t('budget.editGoal') : t('budget.setGoal')}</button>
            <button type="button" onClick={a.onStartRename} className={actionLink}>{t('common.rename')}</button>
            <button type="button" onClick={a.onAction} className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">{a.actionLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
