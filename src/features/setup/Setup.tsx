import { useState, type FormEvent } from 'react';
import { parseMoney, type Currency } from '../../engine/money.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

export function Setup() {
  const completeSetup = useBudgetStore((s) => s.completeSetup);
  const [accountName, setAccountName] = useState('Checking');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const initialBalance = parseMoney(balance);
    if (!accountName.trim()) return setError('Give the account a name.');
    if (initialBalance === null) return setError('Enter the current balance, e.g. 1500 or 1,500.00.');
    setError(null);
    void completeSetup({ accountName, initialBalance, currency });
  };

  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">Set up your budget</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter the money you have right now. You will give every bit of it a job on the next screen.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Account name
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Current balance
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="EUR">Euro (EUR)</option>
            <option value="USD">US dollar (USD)</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-sky-600 py-2 font-medium text-white hover:bg-sky-700">
          Start budgeting
        </button>
      </form>
    </main>
  );
}
