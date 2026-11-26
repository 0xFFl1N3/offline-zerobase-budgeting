import { useState, type FormEvent } from 'react';
import { formatMoney, parseMoney } from '../../engine/money.ts';
import { accountBalances } from '../../engine/reconcile.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Balances of one account and the reconcile flow: compare the cleared balance with the bank statement. */
export function ReconcilePanel({ accountId }: { accountId: string }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const reconcileAccount = useBudgetStore((s) => s.reconcileAccount);
  const fmt = (c: number) => formatMoney(c, currency);

  const [open, setOpen] = useState(false);
  const [statementText, setStatementText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const balances = accountBalances(state, accountId);
  const statement = parseMoney(statementText);
  const difference = statement === null ? null : statement - balances.cleared;

  const close = () => {
    setOpen(false);
    setStatementText('');
    setCategoryId('');
    setError(null);
  };

  const finish = (e: FormEvent) => {
    e.preventDefault();
    if (statement === null || difference === null) return setError('Enter the balance from your statement, e.g. 1234.56.');
    if (difference < 0 && !categoryId) return setError('Choose the category the missing money came out of.');
    const locked = balances.clearedCount;
    void reconcileAccount(accountId, statement, difference === 0 ? null : categoryId || null).then(() => {
      setDone(
        `${account.name} is reconciled at ${fmt(statement)}` +
          (locked > 0 ? `; ${locked} transaction${locked === 1 ? ' is' : 's are'} now locked` : '') +
          (difference !== 0 ? `, with an adjustment of ${fmt(difference)}` : '') +
          '.',
      );
      close();
    });
  };

  return (
    <div className="mt-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-xs text-slate-500">Cleared</span>{' '}
          <span className="font-semibold tabular-nums">{fmt(balances.cleared)}</span>
        </span>
        <span>
          <span className="text-xs text-slate-500">Uncleared</span> <span className="tabular-nums">{fmt(balances.uncleared)}</span>
        </span>
        <span>
          <span className="text-xs text-slate-500">Working balance</span> <span className="tabular-nums">{fmt(balances.working)}</span>
        </span>
        <span className="text-xs text-slate-500">
          {account.lastReconciled ? `Last reconciled ${account.lastReconciled}` : 'Never reconciled'}
        </span>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setDone(null); }} className="ml-auto rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            Reconcile
          </button>
        )}
      </div>
      {done && !open && <p className="mt-2 text-sm text-emerald-700" role="status">{done}</p>}

      {open && (
        <form onSubmit={finish} className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600">
              Balance on your bank statement
              <input
                autoFocus
                value={statementText}
                onChange={(e) => { setStatementText(e.target.value); setError(null); }}
                inputMode="decimal"
                placeholder="0.00"
                className={`${field} mt-1 block w-36 text-right tabular-nums`}
              />
            </label>
            {difference !== null && (
              <p className="pb-1.5 text-sm" role="status">
                {difference === 0 ? (
                  <span className="text-emerald-700">Matches the cleared balance.</span>
                ) : (
                  <span className="text-amber-700">
                    {fmt(Math.abs(difference))} {difference > 0 ? 'more' : 'less'} than the cleared balance.
                  </span>
                )}
              </p>
            )}
          </div>

          {difference !== null && difference !== 0 && (
            <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Tick the circle on each transaction below that appears on your statement, and untick any that doesn't. If it still
                differs, finishing adds an adjustment of <span className="font-semibold tabular-nums">{fmt(difference)}</span>.
              </p>
              <label className="mt-2 block text-xs font-medium">
                Adjustment category
                <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setError(null); }} className={`${field} mt-1 block`}>
                  <option value="">{difference > 0 ? 'Income (Ready to Assign)' : 'Choose a category…'}</option>
                  {state.groups.filter((g) => !g.archived).map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {state.categories.filter((c) => c.groupId === g.id && !c.archived).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={difference === null} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
              {difference !== null && difference !== 0 ? 'Add adjustment and finish' : 'Finish reconciling'}
            </button>
            <button type="button" onClick={close} className="text-sm text-slate-600 hover:underline">Cancel</button>
            <span className="text-xs text-slate-500">Finishing locks the {balances.clearedCount} cleared transaction{balances.clearedCount === 1 ? '' : 's'}.</span>
          </div>
        </form>
      )}
    </div>
  );
}
