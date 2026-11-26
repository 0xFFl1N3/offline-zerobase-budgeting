import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { archivedCategoryIds, runningBalances } from '../../engine/budget.ts';
import { formatMoney, parseMoney } from '../../engine/money.ts';
import { toISODate } from '../../engine/months.ts';
import { clearedStatus, isReconciled, keepCleared } from '../../engine/reconcile.ts';
import { FREQUENCIES, FREQUENCY_LABELS } from '../../engine/recurring.ts';
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
import { buildTransaction, toForm, type TxForm, type TxKind } from './buildTransaction.ts';

const blankForm = (accounts: Account[], kind: TxKind = 'outflow'): TxForm => ({
  kind,
  date: toISODate(),
  accountId: accounts[0]?.id ?? '',
  payee: '',
  categoryId: null,
  transferAccountId: null,
  memo: '',
  amount: 0,
});

const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

export function TransactionsView() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const saveTransaction = useBudgetStore((s) => s.saveTransaction);
  const startRecurringSeries = useBudgetStore((s) => s.startRecurringSeries);
  const removeTransaction = useBudgetStore((s) => s.removeTransaction);
  const setCleared = useBudgetStore((s) => s.setCleared);

  const accounts = state.accounts.filter((a) => !a.closed);

  const [form, setForm] = useState<TxForm>(() => blankForm(accounts));
  const [amountText, setAmountText] = useState('');
  /** Repeat choice for a new transaction; '' = just once. */
  const [repeat, setRepeat] = useState<Frequency | ''>('');
  /** The transaction whose "make recurring" panel is open. */
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  /** When set, the outflow is split: one row per part, with the amount as typed. */
  const [splitRows, setSplitRows] = useState<{ categoryId: string; text: string }[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TxFilters>(NO_FILTERS);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const filterAccount = filters.accountId;
  const setFilter = (patch: Partial<TxFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const update = (patch: Partial<TxForm>) => setForm((f) => ({ ...f, ...patch }));

  const reset = (keep?: TxForm) => {
    setForm({ ...blankForm(accounts, keep?.kind), date: keep?.date ?? toISODate(), accountId: keep?.accountId ?? accounts[0]?.id ?? '' });
    setAmountText('');
    setSplitRows(null);
    setRepeat('');
    setEditingId(null);
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseMoney(amountText);
    if (parsed === null) return setError('Enter a valid amount, e.g. 12.50.');
    let splits: TxForm['splits'] = null;
    if (form.kind === 'outflow' && splitRows) {
      const amounts = splitRows.map((r) => parseMoney(r.text));
      if (amounts.some((a) => a === null)) return setError('Enter a valid amount for every part of the split.');
      splits = splitRows.map((r, i) => ({ categoryId: r.categoryId || null, amount: Math.abs(amounts[i] as number) }));
    }
    const result = buildTransaction({ ...form, amount: Math.abs(parsed), splits }, editingId ?? crypto.randomUUID());
    if (!result.ok) return setError(result.error);
    if (repeat && !editingId) void startRecurringSeries(result.transaction, repeat, null);
    else void saveTransaction(keepCleared(state.transactions.find((t) => t.id === editingId), result.transaction));
    reset(form);
  };

  const startEdit = (t: Transaction) => {
    if (isReconciled(t) && !window.confirm('This transaction is reconciled. Edit it anyway? Changing the amount or date will make the account differ from the reconciled statement.')) return;
    setForm(toForm(t));
    setAmountText((Math.abs(t.amount) / 100).toFixed(2));
    setSplitRows(t.splits ? t.splits.map((p) => ({ categoryId: p.categoryId, text: (Math.abs(p.amount) / 100).toFixed(2) })) : null);
    setEditingId(t.id);
    setError(null);
  };

  const rows = useMemo(() => filterTransactions(state, filters), [state, filters]);
  // Totals of what is listed; transfers are left out because they only move money between accounts.
  const shown = rows.filter((t) => t.transferAccountId === null);
  const totalOut = shown.filter((t) => t.amount < 0).reduce((sum, t) => sum - t.amount, 0);
  const totalIn = shown.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

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

  const total = parseMoney(amountText);
  const splitRemaining = splitRows && total !== null
    ? Math.abs(total) - splitRows.reduce((sum, r) => sum + Math.abs(parseMoney(r.text) ?? 0), 0)
    : null;
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? '?';

  return (
    <section className="p-6">
      <DueBanner />

      <form onSubmit={submit} className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{editingId ? 'Edit transaction' : 'Add transaction'}</h2>
          {!importing && (
            <button type="button" onClick={() => { setImporting(true); setImportMessage(null); }} className="text-sm text-sky-700 hover:underline">
              Import from bank (CSV)…
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Type
            <select value={form.kind} onChange={(e) => {
              update({ kind: e.target.value as TxKind, categoryId: null, transferAccountId: null });
              setSplitRows(null);
            }} className={`${field} mt-1 block`}>
              <option value="outflow">Outflow</option>
              <option value="inflow">Inflow</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Date
            <input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} className={`${field} mt-1 block`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            {form.kind === 'transfer' ? 'From account' : 'Account'}
            <select value={form.accountId} onChange={(e) => update({ accountId: e.target.value })} className={`${field} mt-1 block`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          {form.kind === 'transfer' ? (
            <label className="text-xs font-medium text-slate-600">
              To account
              <select value={form.transferAccountId ?? ''} onChange={(e) => update({ transferAccountId: e.target.value || null })} className={`${field} mt-1 block`}>
                <option value="">Choose…</option>
                {accounts.filter((a) => a.id !== form.accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="min-w-0 flex-1 basis-24 text-xs font-medium text-slate-600">
                Payee
                <input value={form.payee} onChange={(e) => update({ payee: e.target.value })} placeholder="Who" className={`${field} mt-1 block w-full`} />
              </label>
              <div className="text-xs font-medium text-slate-600">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="tx-category">Category</label>
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
                      {splitRows ? 'Single' : 'Split…'}
                    </button>
                  )}
                </div>
                {splitRows ? (
                  <span className={`${field} mt-1 block border-dashed text-slate-500`}>Split across categories</span>
                ) : (
                  <select id="tx-category" value={form.categoryId ?? ''} onChange={(e) => update({ categoryId: e.target.value || null })} className={`${field} mt-1 block`}>
                    <option value="">{form.kind === 'inflow' ? 'Income (Ready to Assign)' : 'Choose a category…'}</option>
                    {categoryOptions(form.categoryId)}
                  </select>
                )}
              </div>
            </>
          )}
          <label className="min-w-0 flex-1 basis-24 text-xs font-medium text-slate-600">
            Memo
            <input value={form.memo} onChange={(e) => update({ memo: e.target.value })} placeholder="Optional" className={`${field} mt-1 block w-full`} />
          </label>
          {!editingId && (
            <label className="text-xs font-medium text-slate-600">
              Repeat
              <select aria-label="Repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Frequency | '')} className={`${field} mt-1 block w-24`}>
                <option value="">Once</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-slate-600">
            Amount
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${field} mt-1 block w-24 text-right tabular-nums`} />
          </label>
          <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            {editingId ? 'Save' : 'Add'}
          </button>
          {editingId && (
            <button type="button" onClick={() => reset()} className="text-sm text-slate-600 hover:underline">
              Cancel
            </button>
          )}
        </div>
        {splitRows && form.kind === 'outflow' && (
          <div className="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
            {splitRows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3">
                <select
                  aria-label={`Category for part ${i + 1}`}
                  value={row.categoryId}
                  onChange={(e) => setSplitRows(splitRows.map((r, j) => (j === i ? { ...r, categoryId: e.target.value } : r)))}
                  className={field}
                >
                  <option value="">Choose a category…</option>
                  {categoryOptions(row.categoryId)}
                </select>
                <input
                  aria-label={`Amount for part ${i + 1}`}
                  value={row.text}
                  onChange={(e) => setSplitRows(splitRows.map((r, j) => (j === i ? { ...r, text: e.target.value } : r)))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`${field} w-28 text-right tabular-nums`}
                />
                {splitRows.length > 2 && (
                  <button type="button" aria-label={`Remove part ${i + 1}`} onClick={() => setSplitRows(splitRows.filter((_, j) => j !== i))} className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button type="button" onClick={() => setSplitRows([...splitRows, { categoryId: '', text: splitRemaining && splitRemaining > 0 ? (splitRemaining / 100).toFixed(2) : '' }])} className="text-sky-700 hover:underline">
                + Add part
              </button>
              {splitRemaining !== null && (
                <span className={splitRemaining === 0 ? 'text-emerald-700' : 'text-amber-700'} role="status">
                  {splitRemaining === 0 ? 'The parts add up to the total.' : splitRemaining > 0 ? `${formatMoney(splitRemaining, currency)} left to split` : `${formatMoney(-splitRemaining, currency)} too much`}
                </span>
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

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

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Account
          <select aria-label="Filter by account" value={filters.accountId} onChange={(e) => setFilter({ accountId: e.target.value })} className={`${field} mt-1 block`}>
            <option value="all">All accounts</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.closed ? ' (closed)' : ''}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Category
          <select aria-label="Filter by category" value={filters.category} onChange={(e) => setFilter({ category: e.target.value })} className={`${field} mt-1 block`}>
            <option value="all">All categories</option>
            <option value="income">Income</option>
            <option value="transfers">Transfers</option>
            <option value="uncategorised">Needs a category</option>
            {state.groups.map((g) => (
              <optgroup key={g.id} label={g.archived ? `${g.name} (archived)` : g.name}>
                <option value={`group:${g.id}`}>All of {g.name}</option>
                {state.categories.filter((c) => c.groupId === g.id).map((c) => (
                  <option key={c.id} value={`cat:${c.id}`}>{c.name}{c.archived ? ' (archived)' : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          From
          <input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter({ from: e.target.value })} className={`${field} mt-1 block`} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To
          <input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter({ to: e.target.value })} className={`${field} mt-1 block`} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Search
          <input aria-label="Search" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} placeholder="Payee, memo or category" className={`${field} mt-1 block w-56`} />
        </label>
        {hasActiveFilters(filters) && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="pb-1.5 text-sm text-sky-700 hover:underline">
            Clear filters
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600" aria-live="polite">
        {hasActiveFilters(filters) ? `${rows.length} of ${state.transactions.length} transactions` : `${rows.length} transactions`}
        {shown.length > 0 && (
          <>
            {' · '}Outflow <span className="tabular-nums">{formatMoney(totalOut, currency)}</span>
            {' · '}Inflow <span className="tabular-nums">{formatMoney(totalIn, currency)}</span>
            <span className="text-slate-400"> (transfers excluded)</span>
          </>
        )}
      </p>
      {filterAccount !== 'all' ? (
        <ReconcilePanel key={filterAccount} accountId={filterAccount} />
      ) : (
        <p className="mt-1 text-xs text-slate-500">Pick one account above to see its cleared balance and reconcile it.</p>
      )}

      <div className="mt-2 overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 py-2 pl-4"><span className="sr-only">Cleared</span></th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Payee</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Memo</th>
              <th className="px-4 py-2 text-right">Outflow</th>
              <th className="px-4 py-2 text-right">Inflow</th>
              {balances && <th className="px-4 py-2 text-right">Balance</th>}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={balances ? 10 : 9} className="px-4 py-6 text-slate-500">
                  {hasActiveFilters(filters) ? 'No transactions match these filters.' : 'No transactions yet.'}
                </td>
              </tr>
            )}
            {rows.map((t) => {
              // For the destination account of a transfer, show the money as an inflow.
              const mirrored = filterAccount !== 'all' && t.transferAccountId === filterAccount && t.accountId !== filterAccount;
              const amount = mirrored ? -t.amount : t.amount;
              // The status shown is the selected account's side; with all accounts, the sending side.
              const side = mirrored ? filterAccount : t.accountId;
              const status = clearedStatus(t, side);
              const toggle = () => {
                if (status === 'reconciled') {
                  if (window.confirm('This transaction is reconciled. Unlock it and mark it as cleared?')) void setCleared(t.id, side, 'cleared');
                } else void setCleared(t.id, side, status === 'cleared' ? 'uncleared' : 'cleared');
              };
              return (
                <Fragment key={t.id}>
                <tr className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2 pl-4"><ClearedToggle status={status} onToggle={toggle} /></td>
                  <td className="px-4 py-2 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-2">{accountName(t.accountId)}</td>
                  <td className="px-4 py-2">{t.payee}</td>
                  <td className="px-4 py-2">{categoryLabel(state, t)}</td>
                  <td className="px-4 py-2 text-slate-600">{t.memo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{amount < 0 ? formatMoney(-amount, currency) : ''}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{amount > 0 ? formatMoney(amount, currency) : ''}</td>
                  {balances && <td className="px-4 py-2 text-right tabular-nums text-slate-600">{formatMoney(balances.get(t.id) ?? 0, currency)}</td>}
                  <td className="px-4 py-2 whitespace-nowrap text-right">
                    <button type="button" onClick={() => startEdit(t)} className="text-sky-700 hover:underline">Edit</button>
                    <button type="button" onClick={() => setRepeatingId(repeatingId === t.id ? null : t.id)} className="ml-3 text-sky-700 hover:underline">Repeat…</button>
                    <button
                      type="button"
                      onClick={() => {
                        const question = isReconciled(t) ? 'This transaction is reconciled. Delete it anyway? The account will no longer match the reconciled statement.' : 'Delete this transaction?';
                        if (window.confirm(question)) void removeTransaction(t.id);
                      }}
                      className="ml-3 text-red-600 hover:underline"
                    >
                      Delete
                    </button>
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
    </section>
  );
}
