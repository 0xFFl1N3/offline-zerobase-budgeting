import { useState, type FormEvent } from 'react';
import { accountBalance } from '../../engine/budget.ts';
import { formatMoney, parseMoney } from '../../engine/money.ts';
import type { AccountType } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

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

export function AccountsSidebar() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const [adding, setAdding] = useState(false);
  const accounts = state.accounts.filter((a) => !a.closed);
  const total = accounts.reduce((sum, a) => sum + accountBalance(state, a.id), 0);

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts</h2>
      <ul className="mt-3 space-y-1">
        {accounts.map((a) => (
          <li key={a.id} className="flex justify-between text-sm">
            <span>{a.name}</span>
            <span className="tabular-nums">{formatMoney(accountBalance(state, a.id), currency)}</span>
          </li>
        ))}
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
    </aside>
  );
}
