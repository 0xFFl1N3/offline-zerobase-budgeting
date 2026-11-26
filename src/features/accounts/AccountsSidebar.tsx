import { useState, type FormEvent } from 'react';
import { accountBalance } from '../../engine/budget.ts';
import { formatMoney, parseMoney } from '../../engine/money.ts';
import type { Account, AccountType } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { MoveButtons } from '../../components/MoveButtons.tsx';
import { BackupPanel } from '../backup/BackupPanel.tsx';

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const addAccount = useBudgetStore((s) => s.addAccount);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('savings');
  const [balance, setBalance] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const opening = balance.trim() === '' ? 0 : parseMoney(balance);
    if (!name.trim() || opening === null) return;
    void addAccount(name, type, opening);
    onDone();
  };

  const field = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" className={field} />
      <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={field}>
        <option value="checking">Checking</option>
        <option value="cash">Cash</option>
        <option value="savings">Savings</option>
      </select>
      <input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance" inputMode="decimal" className={field} />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700">Add</button>
        <button type="button" onClick={onDone} className="text-sm text-slate-600 hover:underline">Cancel</button>
      </div>
    </form>
  );
}

function EditAccountForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const editAccount = useBudgetStore((s) => s.editAccount);
  const setAccountClosed = useBudgetStore((s) => s.setAccountClosed);
  const deleteAccount = useBudgetStore((s) => s.deleteAccount);
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [opening, setOpening] = useState((account.openingBalance / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);

  const used = state.transactions.some((t) => t.accountId === account.id || t.transferAccountId === account.id);
  const balance = accountBalance(state, account.id);

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(opening);
    if (!name.trim()) return setError('An account needs a name.');
    if (cents === null) return setError('Enter the opening balance as a number.');
    void run(() => editAccount(account.id, { name, type, openingBalance: cents }));
  };

  const field = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
  return (
    <form onSubmit={submit} className="mt-1 mb-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
      <label className="block text-xs font-medium text-slate-600">
        Name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Type
        <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={`${field} mt-1`}>
          <option value="checking">Checking</option>
          <option value="cash">Cash</option>
          <option value="savings">Savings</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Opening balance
        <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" className={`${field} mt-1 text-right tabular-nums`} />
      </label>
      <p className="text-xs text-slate-500">The opening balance counts toward Ready to Assign; changing it changes that amount.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700">Save</button>
        <button type="button" onClick={onDone} className="text-sm text-slate-600 hover:underline">Cancel</button>
        {used ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Close ${account.name}? It disappears from the account list and from new transactions; past transactions stay. You can reopen it from the Closed list.`)) {
                void run(() => setAccountClosed(account.id, true));
              }
            }}
            className="ml-auto text-sm text-red-600 hover:underline"
            title={balance !== 0 ? `Balance is ${formatMoney(balance, currency)}; move it to another account first.` : undefined}
          >
            Close account
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const lines = [`Delete ${account.name}?`];
              if (account.openingBalance !== 0) lines.push(`Its opening balance of ${formatMoney(account.openingBalance, currency)} is removed from Ready to Assign.`);
              if (window.confirm(lines.join('\n\n'))) void run(() => deleteAccount(account.id));
            }}
            className="ml-auto text-sm text-red-600 hover:underline"
          >
            Delete account
          </button>
        )}
      </div>
    </form>
  );
}

export function AccountsSidebar() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const setAccountClosed = useBudgetStore((s) => s.setAccountClosed);
  const moveAccount = useBudgetStore((s) => s.moveAccount);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const accounts = state.accounts.filter((a) => !a.closed);
  const closed = state.accounts.filter((a) => a.closed);
  const total = accounts.reduce((sum, a) => sum + accountBalance(state, a.id), 0);

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts</h2>
      <ul className="mt-3 space-y-1">
        {accounts.map((a, index) =>
          editing === a.id ? (
            <li key={a.id}>
              <EditAccountForm account={a} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className="group flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setEditing(a.id)}
                aria-label={`Edit ${a.name}`}
                title="Click to edit"
                className="truncate rounded text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {a.name}
              </button>
              <MoveButtons
                label={a.name}
                onUp={index > 0 ? () => void moveAccount(a.id, -1) : null}
                onDown={index < accounts.length - 1 ? () => void moveAccount(a.id, 1) : null}
              />
              <span className="ml-auto tabular-nums">{formatMoney(accountBalance(state, a.id), currency)}</span>
            </li>
          ),
        )}
      </ul>
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 text-sm font-medium">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(total, currency)}</span>
      </div>
      {adding ? (
        <AddAccountForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-4 text-sm text-sky-700 hover:underline">
          + Add account
        </button>
      )}
      {closed.length > 0 && (
        <div className="mt-4 text-sm">
          <button type="button" onClick={() => setShowClosed((v) => !v)} aria-expanded={showClosed} className="text-slate-600 hover:underline">
            {showClosed ? '▾' : '▸'} Closed ({closed.length})
          </button>
          {showClosed && (
            <ul className="mt-2 space-y-1">
              {closed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-500">{a.name}</span>
                  <button type="button" onClick={() => void setAccountClosed(a.id, false)} className="text-sky-700 hover:underline">Reopen</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <BackupPanel />
    </aside>
  );
}
