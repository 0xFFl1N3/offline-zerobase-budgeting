import { useMemo, useState, type FormEvent } from 'react';
import { formatMoney, parseMoney } from '../../engine/money.ts';
import { toISODate } from '../../engine/months.ts';
import type { Account, BudgetState, Transaction } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
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

function categoryLabel(state: BudgetState, t: Transaction): string {
  if (t.transferAccountId) {
    const from = state.accounts.find((a) => a.id === t.accountId)?.name ?? '?';
    const to = state.accounts.find((a) => a.id === t.transferAccountId)?.name ?? '?';
    return `Transfer: ${from} → ${to}`;
  }
  if (t.categoryId) return state.categories.find((c) => c.id === t.categoryId)?.name ?? 'Unknown category';
  return t.amount > 0 ? 'Income (Ready to Assign)' : 'Uncategorized';
}

const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

export function TransactionsView() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const saveTransaction = useBudgetStore((s) => s.saveTransaction);
  const removeTransaction = useBudgetStore((s) => s.removeTransaction);

  const accounts = state.accounts.filter((a) => !a.closed);
  const [form, setForm] = useState<TxForm>(() => blankForm(accounts));
  const [amountText, setAmountText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterAccount, setFilterAccount] = useState('all');
  const [search, setSearch] = useState('');

  const update = (patch: Partial<TxForm>) => setForm((f) => ({ ...f, ...patch }));

  const reset = (keep?: TxForm) => {
    setForm({ ...blankForm(accounts, keep?.kind), date: keep?.date ?? toISODate(), accountId: keep?.accountId ?? accounts[0]?.id ?? '' });
    setAmountText('');
    setEditingId(null);
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseMoney(amountText);
    if (parsed === null) return setError('Enter a valid amount, e.g. 12.50.');
    const result = buildTransaction({ ...form, amount: Math.abs(parsed) }, editingId ?? crypto.randomUUID());
    if (!result.ok) return setError(result.error);
    void saveTransaction(result.transaction);
    reset(form);
  };

  const startEdit = (t: Transaction) => {
    setForm(toForm(t));
    setAmountText((Math.abs(t.amount) / 100).toFixed(2));
    setEditingId(t.id);
    setError(null);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.transactions
      .filter((t) => filterAccount === 'all' || t.accountId === filterAccount || t.transferAccountId === filterAccount)
      .filter((t) => !q || t.payee.toLowerCase().includes(q) || t.memo.toLowerCase().includes(q))
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  }, [state.transactions, filterAccount, search]);

  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? '?';

  return (
    <section className="p-6">
      <form onSubmit={submit} className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{editingId ? 'Edit transaction' : 'Add transaction'}</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Type
            <select value={form.kind} onChange={(e) => update({ kind: e.target.value as TxKind, categoryId: null, transferAccountId: null })} className={`${field} mt-1 block`}>
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
              <label className="text-xs font-medium text-slate-600">
                Payee
                <input value={form.payee} onChange={(e) => update({ payee: e.target.value })} placeholder="Who" className={`${field} mt-1 block`} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Category
                <select value={form.categoryId ?? ''} onChange={(e) => update({ categoryId: e.target.value || null })} className={`${field} mt-1 block`}>
                  <option value="">{form.kind === 'inflow' ? 'Income (Ready to Assign)' : 'Uncategorized'}</option>
                  {state.groups.filter((g) => !g.archived).map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {state.categories.filter((c) => c.groupId === g.id && !c.archived).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="text-xs font-medium text-slate-600">
            Memo
            <input value={form.memo} onChange={(e) => update({ memo: e.target.value })} placeholder="Optional" className={`${field} mt-1 block`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Amount
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${field} mt-1 block w-28 text-right tabular-nums`} />
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
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select aria-label="Filter by account" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className={field}>
          <option value="all">All accounts</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <input aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payee or memo" className={`${field} w-64`} />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Payee</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Memo</th>
              <th className="px-4 py-2 text-right">Outflow</th>
              <th className="px-4 py-2 text-right">Inflow</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-slate-500">No transactions yet.</td>
              </tr>
            )}
            {rows.map((t) => {
              // For the destination account of a transfer, show the money as an inflow.
              const mirrored = filterAccount !== 'all' && t.transferAccountId === filterAccount && t.accountId !== filterAccount;
              const amount = mirrored ? -t.amount : t.amount;
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-2 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-2">{accountName(t.accountId)}</td>
                  <td className="px-4 py-2">{t.payee}</td>
                  <td className="px-4 py-2">{categoryLabel(state, t)}</td>
                  <td className="px-4 py-2 text-slate-600">{t.memo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{amount < 0 ? formatMoney(-amount, currency) : ''}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{amount > 0 ? formatMoney(amount, currency) : ''}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right">
                    <button type="button" onClick={() => startEdit(t)} className="text-sky-700 hover:underline">Edit</button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this transaction?')) void removeTransaction(t.id);
                      }}
                      className="ml-3 text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
