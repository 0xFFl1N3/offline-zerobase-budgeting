import { Fragment, useEffect, useMemo, useState } from 'react';
import { archivedCategoryIds, isOffBudget, runningBalances } from '../../engine/budget.ts';
import { formatMoney, toAmountInput } from '../../engine/money.ts';
import { parseAmountInput } from '../../engine/amountInput.ts';
import { formatDate, toISODate } from '../../engine/months.ts';
import { clearedStatus, isReconciled, keepCleared } from '../../engine/reconcile.ts';
import { FREQUENCIES } from '../../engine/recurring.ts';
import { t as tr } from '../../i18n/i18n.ts';
import type { Account, Frequency, Transaction } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { DueBanner } from '../recurring/DueBanner.tsx';
import { MakeRecurringForm } from '../recurring/MakeRecurringForm.tsx';
import { RecurringList } from '../recurring/RecurringList.tsx';
import { categoryLabel } from './labels.ts';
import { ClearedToggle } from './ClearedToggle.tsx';
import { ReconcilePanel } from './ReconcilePanel.tsx';
import { ImportPanel } from '../import/ImportPanel.tsx';
import { filterTransactions, hasActiveFilters, NO_FILTERS, type TxFilters } from './filterTransactions.ts';
import { useNavigation } from '../../store/navigation.ts';
import { buildTransaction, toForm, type TxForm, type TxKind } from './buildTransaction.ts';
import { useAction } from '../errors/useAction.ts';
import { overpayment } from '../../engine/debt.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { Form } from '../../components/Form.tsx';
import { fillFromPayee, payeeMemory, type PayeeInfo } from '../../engine/payees.ts';
import { PayeeField } from './PayeeField.tsx';
import { SumHint } from '../../components/SumHint.tsx';

const blankForm = (accounts: Account[], kind: TxKind = 'outflow'): TxForm => ({
  kind,
  date: toISODate(),
  // Spending and income happen in budget accounts; a debt is only reached by a transfer.
  accountId: (kind === 'transfer' ? accounts : accounts.filter((a) => !isOffBudget(a)))[0]?.id ?? '',
  payee: '',
  categoryId: null,
  transferAccountId: null,
  memo: '',
  amount: 0,
});

const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** How many transactions the list draws at first, and how many more each click adds. */
const PAGE_SIZE = 100;

export function TransactionsView() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const saveTransaction = useBudgetStore((s) => s.saveTransaction);
  const startRecurringSeries = useBudgetStore((s) => s.startRecurringSeries);
  const removeTransaction = useBudgetStore((s) => s.removeTransaction);
  const setCleared = useBudgetStore((s) => s.setCleared);

  const accounts = state.accounts.filter((a) => !a.closed);
  const budgetAccounts = accounts.filter((a) => !isOffBudget(a));
  /** A transfer from a budget account to a debt is a payment, spent from the debt's category. */
  const paymentCategoryFor = (fromId: string, toId: string | null): string | null => {
    const to = state.accounts.find((a) => a.id === toId);
    const fromBudget = budgetAccounts.some((a) => a.id === fromId);
    return fromBudget && to?.type === 'debt' ? (to.paymentCategoryId ?? null) : null;
  };

  // "Record payment" on the Budget tab opens this tab with the form filled in.
  const [prefill] = useState(() => useNavigation.getState().pendingTransaction);
  const [form, setForm] = useState<TxForm>(() => (prefill ? { ...blankForm(accounts, 'transfer'), ...prefill, amount: 0 } : blankForm(accounts)));
  // Money leaving the budget (a debt payment, or money into a tracking account) is spent from a category.
  const isPayment =
    form.kind === 'transfer' && budgetAccounts.some((a) => a.id === form.accountId) && state.accounts.some((a) => a.id === form.transferAccountId && isOffBudget(a));
  const [amountText, setAmountText] = useState(() => (prefill && prefill.amount > 0 ? toAmountInput(prefill.amount) : ''));
  /** Repeat choice for a new transaction; '' = just once. */
  const [repeat, setRepeat] = useState<Frequency | ''>('');
  /** The transaction whose "make recurring" panel is open. */
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  /** When set, the outflow is split: one row per part, with the amount as typed. */
  const [splitRows, setSplitRows] = useState<{ categoryId: string; text: string }[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { run, error, setError } = useAction();
  // Another tab may have linked here with filters (e.g. a category from Analytics).
  const [filters, setFilters] = useState<TxFilters>(() => useNavigation.getState().pendingFilters ?? NO_FILTERS);
  useEffect(() => {
    useNavigation.getState().takePendingFilters();
  }, []);
  const [importing, setImporting] = useState(false);
  /** Phones: the add/edit form opens full-screen, filters fold away, and a tapped transaction shows its actions. */
  const [formOpen, setFormOpen] = useState(prefill !== null);
  useEffect(() => {
    useNavigation.getState().takePendingTransaction();
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(() => useNavigation.getState().pendingFilters !== null);
  const [openTx, setOpenTx] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  // Long lists draw the newest rows first and more on request; filters and totals still cover everything.
  const [limit, setLimit] = useState(PAGE_SIZE);
  useEffect(() => setLimit(PAGE_SIZE), [filters]);
  const filterAccount = filters.accountId;
  const setFilter = (patch: Partial<TxFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const update = (patch: Partial<TxForm>) => setForm((f) => ({ ...f, ...patch }));
  // Known payees, worked out from the transactions; only recomputed when they change.
  const payees = useMemo(() => payeeMemory(state), [state.transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  // Choosing a known payee fills in the kind and category used last time (never over a chosen category).
  const pickPayee = (payee: PayeeInfo) => setForm((f) => ({ ...f, ...fillFromPayee(state, { ...f, split: splitRows !== null }, payee) }));

  const reset = (keep?: TxForm) => {
    setForm({ ...blankForm(accounts, keep?.kind), date: keep?.date ?? toISODate(), accountId: keep?.accountId ?? accounts[0]?.id ?? '' });
    setAmountText('');
    setSplitRows(null);
    setRepeat('');
    setEditingId(null);
    setError(null);
    setFormOpen(false);
  };

  const submit = () => {
    const parsed = parseAmountInput(amountText);
    if (parsed === null) return setError(tr('tx.errorAmount'));
    let splits: TxForm['splits'] = null;
    if (form.kind === 'outflow' && splitRows) {
      const amounts = splitRows.map((r) => parseAmountInput(r.text));
      if (amounts.some((a) => a === null)) return setError(tr('tx.errorSplitAmount'));
      splits = splitRows.map((r, i) => ({ categoryId: r.categoryId || null, amount: Math.abs(amounts[i] as number) }));
    }
    // The transfer form has no payee field: a new payment is named after the debt it pays; an edited one
    // (e.g. imported with the bank's payee) keeps its payee.
    const debtName = isPayment ? state.accounts.find((a) => a.id === form.transferAccountId)?.name : undefined;
    const payee = form.payee.trim() || debtName || '';
    const intoTracking = isPayment && state.accounts.find((a) => a.id === form.transferAccountId)?.type === 'tracking';
    if (intoTracking && !form.categoryId) return setError(tr('error.trackingCategory'));
    const result = buildTransaction({ ...form, payee, payment: isPayment, amount: Math.abs(parsed), splits }, editingId ?? crypto.randomUUID());
    if (!result.ok) return setError(result.error);
    // Paying more than is owed is allowed (there can be a reason), but should not happen by mistake. It is only a
    // question for a debt; a tracking account owes nothing.
    if (isPayment && form.transferAccountId && state.accounts.find((a) => a.id === form.transferAccountId)?.type === 'debt') {
      const over = overpayment(state, form.transferAccountId, result.transaction.amount, editingId ?? undefined);
      const name = state.accounts.find((a) => a.id === form.transferAccountId)?.name ?? '';
      if (over > 0 && !window.confirm(tr('debt.overpayConfirm', { amount: formatMoney(over, currency), name }))) return;
    }
    const save =
      repeat && !editingId
        ? () => startRecurringSeries(result.transaction, repeat, null)
        : () => saveTransaction(keepCleared(state.transactions.find((t) => t.id === editingId), result.transaction));
    // Clear the form only once it is saved, so nothing has to be typed again if saving fails.
    void run(save).then((ok) => ok && reset(form));
  };

  const startEdit = (t: Transaction) => {
    if (isReconciled(t) && !window.confirm(tr('tx.confirmEditReconciled'))) return;
    setForm(toForm(t));
    setAmountText(toAmountInput(Math.abs(t.amount)));
    setSplitRows(t.splits ? t.splits.map((p) => ({ categoryId: p.categoryId, text: toAmountInput(Math.abs(p.amount)) })) : null);
    setEditingId(t.id);
    setError(null);
    setFormOpen(true);
  };

  const rows = useMemo(() => filterTransactions(state, filters), [state, filters]);
  // Totals of what is listed; transfers are left out because they only move money between accounts,
  // except debt payments (transfers with a category), which are spending.
  const shown = rows.filter((t) => t.transferAccountId === null || t.categoryId !== null);
  // For the destination account of a transfer, the money comes in: shown (and counted) as an inflow.
  const mirroredFor = (t: Transaction) => filterAccount !== 'all' && t.transferAccountId === filterAccount && t.accountId !== filterAccount;
  const signed = (t: Transaction) => (mirroredFor(t) ? -t.amount : t.amount);
  const totalOut = shown.filter((t) => signed(t) < 0).reduce((sum, t) => sum - signed(t), 0);
  const totalIn = shown.filter((t) => signed(t) > 0).reduce((sum, t) => sum + signed(t), 0);

  /** What each listed transaction shows, for the table and for the phone list. */
  const items = rows.slice(0, limit).map((t) => {
    const mirrored = mirroredFor(t);
    const amount = signed(t);
    // The status shown is the selected account's side; with all accounts, the sending side.
    const side = mirrored ? filterAccount : t.accountId;
    const status = clearedStatus(t, side);
    const toggle = () => {
      if (status === 'reconciled') {
        if (window.confirm(tr('tx.confirmUnlock'))) void setCleared(t.id, side, 'cleared');
      } else void setCleared(t.id, side, status === 'cleared' ? 'uncleared' : 'cleared');
    };
    const remove = () => {
      const question = isReconciled(t) ? tr('tx.confirmDeleteReconciled') : tr('tx.confirmDelete');
      if (window.confirm(question)) void removeTransaction(t.id);
    };
    return { t, amount, status, toggle, remove };
  });
  const activeFilters = hasActiveFilters(filters);
  const phoneFields = 'max-md:*:w-full max-md:[&_input]:w-full max-md:[&_select]:w-full';

  // With one account selected, show its balance after each transaction.
  const balances = useMemo(
    () => (filters.accountId === 'all' ? null : runningBalances(state, filters.accountId)),
    [state, filters.accountId],
  );
  /** The category choices; an archived category that is already selected stays selectable. */
  const categoryOptions = (selectedId: string | null) => {
    const archivedSelected = selectedId && archivedCategoryIds(state).has(selectedId) ? state.categories.find((c) => c.id === selectedId) : undefined;
    return (
      <>
        {archivedSelected && <option value={archivedSelected.id}>{archivedSelected.name} (archived)</option>}
        {state.groups.filter((g) => !g.archived).map((g) => (
          <optgroup key={g.id} label={g.name}>
            {state.categories.filter((c) => c.groupId === g.id && !c.archived).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        ))}
      </>
    );
  };

  const total = parseAmountInput(amountText);
  const splitRemaining = splitRows && total !== null
    ? Math.abs(total) - splitRows.reduce((sum, r) => sum + Math.abs(parseAmountInput(r.text) ?? 0), 0)
    : null;
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? '?';

  return (
    <section className="p-3 md:p-6">
      <DueBanner />

      {/* Phones: filter and import buttons; adding is the round + button. */}
      <div className="mb-3 flex gap-2 md:hidden">
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
          {tr('tx.filters')}{activeFilters ? tr('tx.filtersOn') : ''}
        </button>
        {!importing && (
          <button type="button" onClick={() => { setImporting(true); setImportMessage(null); }} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
            {tr('tx.importShort')}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          reset();
          setFormOpen(true);
        }}
        aria-label={tr('tx.add')}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-3xl leading-none text-white shadow-lg hover:bg-sky-700 md:hidden"
      >
        +
      </button>

      {/* On phones the form opens full-screen; on larger screens it is always shown. */}
      <Form
        onSubmit={submit}
        className={`bg-white p-4 md:static md:block md:rounded-lg md:shadow-sm ${formOpen ? 'fixed inset-0 z-40 overflow-y-auto' : 'hidden'}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold md:text-sm">{editingId ? tr('tx.edit') : tr('tx.add')}</h2>
          {!importing && (
            <button type="button" onClick={() => { setImporting(true); setImportMessage(null); }} className="hidden text-sm text-sky-700 hover:underline md:inline">
              {tr('tx.importLong')}
            </button>
          )}
          <button type="button" onClick={() => reset()} className="text-sm text-slate-600 md:hidden">{tr('common.close')}</button>
        </div>
        <div className={`mt-3 flex flex-wrap items-end gap-3 ${phoneFields}`}>
          <label className="text-xs font-medium text-slate-600">
            {tr('tx.type')}
            <select value={form.kind} onChange={(e) => {
              const kind = e.target.value as TxKind;
              // Leaving a transfer that started from a debt: spending and income need a budget account.
              const fromDebt = kind !== 'transfer' && !budgetAccounts.some((a) => a.id === form.accountId);
              update({ kind, categoryId: null, transferAccountId: null, ...(fromDebt && { accountId: budgetAccounts[0]?.id ?? '' }) });
              setSplitRows(null);
            }} className={`${field} mt-1 block`}>
              <option value="outflow">{tr('tx.outflow')}</option>
              <option value="inflow">{tr('tx.inflow')}</option>
              <option value="transfer">{tr('tx.transfer')}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {tr('tx.date')}
            <input {...NO_AUTOFILL} type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} className={`${field} mt-1 block`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            {form.kind === 'transfer' ? tr('tx.fromAccount') : tr('tx.account')}
            <select
              value={form.accountId}
              onChange={(e) =>
                update({ accountId: e.target.value, ...(form.kind === 'transfer' && { categoryId: paymentCategoryFor(e.target.value, form.transferAccountId) }) })
              }
              className={`${field} mt-1 block`}
            >
              {(form.kind === 'transfer' ? accounts : budgetAccounts).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          {form.kind === 'transfer' ? (
            <label className="text-xs font-medium text-slate-600">
              {tr('tx.toAccount')}
              <select
                value={form.transferAccountId ?? ''}
                onChange={(e) => update({ transferAccountId: e.target.value || null, categoryId: paymentCategoryFor(form.accountId, e.target.value || null) })}
                className={`${field} mt-1 block`}
              >
                <option value="">{tr('tx.choose')}</option>
                {accounts.filter((a) => a.id !== form.accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {isPayment && (
            // Money leaving the budget is spent from a category: for a debt its own, unless another is chosen; for a
            // tracking account one has to be chosen.
            <label className="text-xs font-medium text-slate-600">
              {tr('tx.category')}
              <select value={form.categoryId ?? ''} onChange={(e) => update({ categoryId: e.target.value || null })} className={`${field} mt-1 block`}>
                <option value="">{tr('tx.chooseCategory')}</option>
                {categoryOptions(form.categoryId)}
              </select>
            </label>
          )}
          {form.kind !== 'transfer' && (
            <>
              <label className="min-w-0 flex-1 basis-24 text-xs font-medium text-slate-600">
                {tr('tx.payee')}
                <PayeeField
                  value={form.payee}
                  onChange={(payee) => update({ payee })}
                  onPick={pickPayee}
                  memory={payees}
                  placeholder={tr('tx.payeePlaceholder')}
                  className={`${field} mt-1 block w-full`}
                />
              </label>
              <div className="text-xs font-medium text-slate-600">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="tx-category">{tr('tx.category')}</label>
                  {form.kind === 'outflow' && (
                    <button
                      type="button"
                      onClick={() =>
                        setSplitRows(
                          splitRows
                            ? null
                            : [
                                { categoryId: form.categoryId ?? '', text: amountText },
                                { categoryId: '', text: '' },
                              ],
                        )
                      }
                      className="font-normal text-sky-700 hover:underline"
                    >
                      {splitRows ? tr('tx.single') : tr('tx.split')}
                    </button>
                  )}
                </div>
                {splitRows ? (
                  <span className={`${field} mt-1 block border-dashed text-slate-500`}>{tr('tx.splitAcross')}</span>
                ) : (
                  <select id="tx-category" value={form.categoryId ?? ''} onChange={(e) => update({ categoryId: e.target.value || null })} className={`${field} mt-1 block`}>
                    <option value="">{form.kind === 'inflow' ? tr('tx.income') : tr('tx.chooseCategory')}</option>
                    {categoryOptions(form.categoryId)}
                  </select>
                )}
              </div>
            </>
          )}
          <label className="min-w-0 flex-1 basis-24 text-xs font-medium text-slate-600">
            {tr('tx.memo')}
            <input {...NO_AUTOFILL} value={form.memo} onChange={(e) => update({ memo: e.target.value })} placeholder={tr('tx.optional')} className={`${field} mt-1 block w-full`} />
          </label>
          {!editingId && (
            <label className="text-xs font-medium text-slate-600">
              {tr('tx.repeat')}
              <select aria-label={tr('tx.repeat')} value={repeat} onChange={(e) => setRepeat(e.target.value as Frequency | '')} className={`${field} mt-1 block w-24`}>
                <option value="">{tr('tx.once')}</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{tr(`frequency.${f}`)}</option>
                ))}
              </select>
            </label>
          )}
          <label className="relative text-xs font-medium text-slate-600">
            {tr('tx.amount')}
            <input {...NO_AUTOFILL} value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="decimal" placeholder={tr('common.amountPlaceholder')} className={`${field} mt-1 block w-24 text-right tabular-nums`} />
            <SumHint text={amountText} />
          </label>
          <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            {editingId ? tr('common.save') : tr('common.add')}
          </button>
          {editingId && (
            <button type="button" onClick={() => reset()} className="text-sm text-slate-600 hover:underline">
              {tr('common.cancel')}
            </button>
          )}
        </div>
        {splitRows && form.kind === 'outflow' && (
          <div className="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
            {splitRows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3">
                <select
                  aria-label={tr('tx.partCategory', { n: i + 1 })}
                  value={row.categoryId}
                  onChange={(e) => setSplitRows(splitRows.map((r, j) => (j === i ? { ...r, categoryId: e.target.value } : r)))}
                  className={field}
                >
                  <option value="">{tr('tx.chooseCategory')}</option>
                  {categoryOptions(row.categoryId)}
                </select>
                <input {...NO_AUTOFILL}
                  aria-label={tr('tx.partAmount', { n: i + 1 })}
                  value={row.text}
                  onChange={(e) => setSplitRows(splitRows.map((r, j) => (j === i ? { ...r, text: e.target.value } : r)))}
                  inputMode="decimal"
                  placeholder={tr('common.amountPlaceholder')}
                  className={`${field} w-28 text-right tabular-nums`}
                />
                {splitRows.length > 2 && (
                  <button type="button" aria-label={tr('tx.partRemove', { n: i + 1 })} onClick={() => setSplitRows(splitRows.filter((_, j) => j !== i))} className="text-sm text-red-600 hover:underline">
                    {tr('tx.remove')}
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button type="button" onClick={() => setSplitRows([...splitRows, { categoryId: '', text: splitRemaining && splitRemaining > 0 ? toAmountInput(splitRemaining) : '' }])} className="text-sky-700 hover:underline">
                {tr('tx.addPart')}
              </button>
              {splitRemaining !== null && (
                <span className={splitRemaining === 0 ? 'text-emerald-700' : 'text-amber-700'} role="status">
                  {splitRemaining === 0 ? tr('tx.splitExact') : splitRemaining > 0 ? tr('tx.splitLeft', { amount: formatMoney(splitRemaining, currency) }) : tr('tx.splitOver', { amount: formatMoney(-splitRemaining, currency) })}
                </span>
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Form>

      {importing && (
        <ImportPanel
          defaultAccountId={filterAccount === 'all' ? null : filterAccount}
          onClose={(message) => {
            setImporting(false);
            setImportMessage(message ?? null);
          }}
        />
      )}
      {importMessage && <p className="mt-3 text-sm text-emerald-700" role="status">{importMessage}</p>}

      <RecurringList />

      <div className={`mt-3 flex-wrap items-end gap-3 md:mt-6 md:flex ${filtersOpen ? 'flex' : 'hidden'} ${phoneFields}`}>
        <label className="text-xs font-medium text-slate-600">
          {tr('tx.account')}
          <select aria-label={tr('tx.filterAccount')} value={filters.accountId} onChange={(e) => setFilter({ accountId: e.target.value })} className={`${field} mt-1 block`}>
            <option value="all">{tr('tx.allAccounts')}</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.closed ? ` (${tr('account.reopen') && tr('recur.ended')})` : ''}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          {tr('tx.category')}
          <select aria-label={tr('tx.filterCategory')} value={filters.category} onChange={(e) => setFilter({ category: e.target.value })} className={`${field} mt-1 block`}>
            <option value="all">{tr('tx.allCategories')}</option>
            <option value="income">{tr('tx.incomeFilter')}</option>
            <option value="transfers">{tr('tx.transfers')}</option>
            <option value="uncategorised">{tr('tx.needsCategory')}</option>
            {state.groups.map((g) => (
              <optgroup key={g.id} label={g.archived ? tr('label.archived', { name: g.name }) : g.name}>
                <option value={`group:${g.id}`}>{tr('tx.allOf', { name: g.name })}</option>
                {state.categories.filter((c) => c.groupId === g.id).map((c) => (
                  <option key={c.id} value={`cat:${c.id}`}>{c.name}{c.archived ? tr('tx.archivedSuffix') : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          {tr('tx.from')}
          <input {...NO_AUTOFILL} type="date" aria-label={tr('tx.fromDate')} value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter({ from: e.target.value })} className={`${field} mt-1 block`} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {tr('tx.to')}
          <input {...NO_AUTOFILL} type="date" aria-label={tr('tx.toDate')} value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter({ to: e.target.value })} className={`${field} mt-1 block`} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {tr('tx.search')}
          <input {...NO_AUTOFILL} aria-label={tr('tx.search')} value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} placeholder={tr('tx.searchPlaceholder')} className={`${field} mt-1 block w-56`} />
        </label>
        {hasActiveFilters(filters) && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="pb-1.5 text-sm text-sky-700 hover:underline">
            {tr('tx.clearFilters')}
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600" aria-live="polite">
        {hasActiveFilters(filters) ? tr('tx.countFiltered', { count: rows.length, total: state.transactions.length }) : tr('tx.count', { count: rows.length })}
        {shown.length > 0 && (
          <>
            {' · '}{tr('tx.totalOut')} <span className="tabular-nums">{formatMoney(totalOut, currency)}</span>
            {' · '}{tr('tx.totalIn')} <span className="tabular-nums">{formatMoney(totalIn, currency)}</span>
            <span className="text-slate-400">{tr('tx.transfersExcluded')}</span>
          </>
        )}
      </p>
      {filterAccount !== 'all' ? (
        <ReconcilePanel key={filterAccount} accountId={filterAccount} />
      ) : (
        <p className="mt-1 text-xs text-slate-500">{tr('tx.pickAccount')}</p>
      )}

      <div className="mt-2 hidden overflow-x-auto rounded-lg bg-white shadow-sm md:block">
        {/* Long names may break inside a word, so the table fits the width instead of scrolling sideways. */}
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 py-2 pl-4"><span className="sr-only">{tr('tx.colCleared')}</span></th>
              <th className="px-3 py-2">{tr('tx.date')}</th>
              <th className="px-3 py-2">{tr('tx.account')}</th>
              <th className="px-3 py-2">{tr('tx.payee')}</th>
              <th className="px-3 py-2">{tr('tx.category')}</th>
              <th className="px-3 py-2">{tr('tx.memo')}</th>
              <th className="px-3 py-2 text-right">{tr('tx.colOutflow')}</th>
              <th className="px-3 py-2 text-right">{tr('tx.colInflow')}</th>
              {balances && <th className="px-3 py-2 text-right">{tr('tx.colBalance')}</th>}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={balances ? 10 : 9} className="px-4 py-6 text-slate-500">
                  {hasActiveFilters(filters) ? tr('tx.noMatch') : tr('tx.none')}
                </td>
              </tr>
            )}
            {items.map(({ t, amount, status, toggle, remove }) => {
              return (
                <Fragment key={t.id}>
                <tr className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2 pl-4"><ClearedToggle status={status} onToggle={toggle} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{accountName(t.accountId)}</td>
                  <td className="[overflow-wrap:anywhere] px-3 py-2">{t.payee}</td>
                  <td className="[overflow-wrap:anywhere] px-3 py-2">{categoryLabel(state, t)}</td>
                  <td className="[overflow-wrap:anywhere] px-3 py-2 text-slate-600">{t.memo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{amount < 0 ? formatMoney(-amount, currency) : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{amount > 0 ? formatMoney(amount, currency) : ''}</td>
                  {balances && <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatMoney(balances.get(t.id) ?? 0, currency)}</td>}
                  {/* Small icons instead of three words, so the table fits without scrolling sideways. */}
                  <td className="py-1 pr-3 pl-1 whitespace-nowrap text-right">
                    <RowAction label={tr('common.edit')} onClick={() => startEdit(t)} icon="edit" />
                    <RowAction label={tr('tx.repeatAction')} onClick={() => setRepeatingId(repeatingId === t.id ? null : t.id)} icon="repeat" />
                    <RowAction label={tr('common.delete')} onClick={remove} icon="delete" />
                  </td>
                </tr>
                {repeatingId === t.id && (
                  <tr className="border-b border-slate-100">
                    <td colSpan={balances ? 10 : 9} className="p-0">
                      <MakeRecurringForm transaction={t} onDone={() => setRepeatingId(null)} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per transaction; tap it for Edit, Repeat and Delete. */}
      {/* mb-20 keeps the last card clear of the round + button. */}
      <ul className="mt-2 divide-y divide-slate-100 rounded-lg bg-white shadow-sm md:hidden">
        {rows.length === 0 && (
          <li className="px-3 py-6 text-sm text-slate-500">{activeFilters ? tr('tx.noMatch') : tr('tx.none')}</li>
        )}
        {items.map(({ t, amount, status, toggle, remove }) => (
          <li key={t.id}>
            <div className="flex items-start gap-2 px-3 py-2.5 text-sm">
              <ClearedToggle status={status} onToggle={toggle} large />
              <button type="button" onClick={() => setOpenTx(openTx === t.id ? null : t.id)} aria-expanded={openTx === t.id} className="min-w-0 flex-1 text-left">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{t.payee || categoryLabel(state, t)}</span>
                  <span className={`shrink-0 tabular-nums ${amount > 0 ? 'text-emerald-700' : ''}`}>{formatMoney(amount, currency)}</span>
                </span>
                <span className="mt-0.5 flex gap-2 text-xs text-slate-500">
                  <span className="min-w-0 flex-1 truncate">
                    {formatDate(t.date)} · {categoryLabel(state, t)}
                    {filterAccount === 'all' && ` · ${accountName(t.accountId)}`}
                  </span>
                  {balances && <span className="shrink-0 tabular-nums">{formatMoney(balances.get(t.id) ?? 0, currency)}</span>}
                </span>
                {t.memo && <span className="mt-0.5 block truncate text-xs text-slate-500">{t.memo}</span>}
              </button>
            </div>
            {openTx === t.id && (
              <div className="flex gap-1 px-10 pb-2.5">
                <button type="button" onClick={() => startEdit(t)} className="rounded px-2 py-1.5 text-sm text-sky-700 hover:bg-sky-50">{tr('common.edit')}</button>
                <button type="button" onClick={() => setRepeatingId(repeatingId === t.id ? null : t.id)} className="rounded px-2 py-1.5 text-sm text-sky-700 hover:bg-sky-50">{tr('tx.repeatAction')}</button>
                <button type="button" onClick={remove} className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">{tr('common.delete')}</button>
              </div>
            )}
            {repeatingId === t.id && <MakeRecurringForm transaction={t} onDone={() => setRepeatingId(null)} />}
          </li>
        ))}
      </ul>
      <div className="mt-3 mb-20 flex items-center gap-3 text-sm md:mb-0">
        {rows.length > limit && (
          <>
            <button type="button" onClick={() => setLimit(limit + PAGE_SIZE)} className="rounded-md px-3 py-1.5 font-medium text-sky-700 ring-1 ring-slate-200 hover:bg-sky-50">
              {tr('tx.showMore', { count: Math.min(PAGE_SIZE, rows.length - limit) })}
            </button>
            <span className="text-slate-500">{tr('tx.shown', { shown: limit, total: rows.length })}</span>
          </>
        )}
      </div>
    </section>
  );
}

const ICONS = {
  edit: 'M3 13.5V16h2.5l7.4-7.4-2.5-2.5L3 13.5Zm11.8-6.8a.7.7 0 0 0 0-1l-1.5-1.5a.7.7 0 0 0-1 0l-1.2 1.2 2.5 2.5 1.2-1.2Z',
  repeat: 'M4 9a5 5 0 0 1 8.5-3.5M16 11a5 5 0 0 1-8.5 3.5M12.5 2.5v3h-3M7.5 17.5v-3h3',
  delete: 'M4 5.5h12M8 5.5V4h4v1.5M5.5 5.5l.7 10.5h7.6l.7-10.5M8.5 8.5v5M11.5 8.5v5',
} as const;

/** An icon button in a transaction row; the name shows on hover and is read out by screen readers. */
function RowAction({ label, onClick, icon }: { label: string; onClick: () => void; icon: keyof typeof ICONS }) {
  const filled = icon === 'edit';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded p-1.5 text-slate-400 ${icon === 'delete' ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-sky-50 hover:text-sky-700'}`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path d={ICONS[icon]} fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
