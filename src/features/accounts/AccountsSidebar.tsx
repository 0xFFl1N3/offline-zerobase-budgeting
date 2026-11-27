import { useState, type FormEvent } from 'react';
import { accountBalance } from '../../engine/budget.ts';
import { formatMoney, parseMoney, toAmountInput } from '../../engine/money.ts';
import type { Account, AccountType } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { MoveButtons, useReorder } from '../../components/reorder.tsx';
import { BackupPanel } from '../backup/BackupPanel.tsx';
import { t } from '../../i18n/i18n.ts';
import { useAction } from '../errors/useAction.ts';
import { activeSeriesUsing } from '../../engine/recurring.ts';

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const addAccount = useBudgetStore((s) => s.addAccount);
  const addDebt = useBudgetStore((s) => s.addDebt);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('savings');
  const [balance, setBalance] = useState('');
  const [minimum, setMinimum] = useState('');
  const { run, error, setError } = useAction();
  const debt = type === 'debt';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = balance.trim() === '' ? 0 : parseMoney(balance);
    if (!name.trim()) return;
    if (amount === null) return setError(t(debt ? 'debt.errorOwed' : 'account.errorOpening'));
    if (debt) {
      const min = minimum.trim() === '' ? null : parseMoney(minimum);
      if (minimum.trim() !== '' && (min === null || min <= 0)) return setError(t('debt.errorMinimum'));
      const input = { name, owed: Math.abs(amount), minimumPayment: min, groupName: t('debt.groupName') };
      void run(() => addDebt(input)).then((ok) => ok && onDone());
    } else {
      void run(() => addAccount(name, type, amount)).then((ok) => ok && onDone());
    }
  };

  const field = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account.namePlaceholder')} className={field} />
      <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={field}>
        <option value="checking">{t('account.checking')}</option>
        <option value="cash">{t('account.cash')}</option>
        <option value="savings">{t('account.savings')}</option>
        <option value="debt">{t('debt.type')}</option>
      </select>
      <input
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        placeholder={t(debt ? 'debt.owed' : 'account.balancePlaceholder')}
        aria-label={t(debt ? 'debt.owed' : 'account.balancePlaceholder')}
        inputMode="decimal"
        className={field}
      />
      {debt && (
        <>
          <p className="text-xs text-slate-500">{t('debt.owedHint')}</p>
          <input value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder={t('debt.minimum')} aria-label={t('debt.minimum')} inputMode="decimal" className={field} />
          <p className="text-xs text-slate-500">{t('debt.addHint', { name: name.trim() || '…', group: t('debt.groupName') })}</p>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700">{t('common.add')}</button>
        <button type="button" onClick={onDone} className="text-sm text-slate-600 hover:underline">{t('common.cancel')}</button>
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
  const debt = account.type === 'debt';
  // A debt's starting balance is shown as the positive amount owed.
  const [opening, setOpening] = useState(toAmountInput(debt ? -account.openingBalance : account.openingBalance));
  const [minimum, setMinimum] = useState(account.minimumPayment ? toAmountInput(account.minimumPayment) : '');
  const { run: runAction, error, setError } = useAction();

  const used =
    state.transactions.some((t) => t.accountId === account.id || t.transferAccountId === account.id) ||
    state.recurring.some((r) => r.template.accountId === account.id || r.template.transferAccountId === account.id);
  const balance = accountBalance(state, account.id);

  const run = async (fn: () => Promise<void>) => {
    if (await runAction(fn)) onDone();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(opening);
    if (!name.trim()) return setError(t('account.errorName'));
    if (cents === null) return setError(t(debt ? 'debt.errorOwed' : 'account.errorOpening'));
    if (!debt) return void run(() => editAccount(account.id, { name, type, openingBalance: cents }));
    const min = minimum.trim() === '' ? null : parseMoney(minimum);
    if (minimum.trim() !== '' && (min === null || min <= 0)) return setError(t('debt.errorMinimum'));
    void run(() => editAccount(account.id, { name, openingBalance: -Math.abs(cents), minimumPayment: min }));
  };

  const field = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
  return (
    <form onSubmit={submit} className="mt-1 mb-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
      <label className="block text-xs font-medium text-slate-600">
        {t('account.name')}
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
      </label>
      {!debt && (
        <label className="block text-xs font-medium text-slate-600">
          {t('account.type')}
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={`${field} mt-1`}>
            <option value="checking">{t('account.checking')}</option>
            <option value="cash">{t('account.cash')}</option>
            <option value="savings">{t('account.savings')}</option>
          </select>
        </label>
      )}
      <label className="block text-xs font-medium text-slate-600">
        {t(debt ? 'debt.owedAtStart' : 'account.opening')}
        <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" className={`${field} mt-1 text-right tabular-nums`} />
      </label>
      {debt ? (
        <label className="block text-xs font-medium text-slate-600">
          {t('debt.minimum')}
          <input value={minimum} onChange={(e) => setMinimum(e.target.value)} inputMode="decimal" className={`${field} mt-1 text-right tabular-nums`} />
        </label>
      ) : (
        <p className="text-xs text-slate-500">{t('account.openingHint')}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700">{t('common.save')}</button>
        <button type="button" onClick={onDone} className="text-sm text-slate-600 hover:underline">{t('common.cancel')}</button>
        {used ? (
          <button
            type="button"
            onClick={() => {
              const series = activeSeriesUsing(state, { accountIds: [account.id] });
              const lines = [t('account.closeConfirm', { name: account.name })];
              if (series.length > 0) lines.push(t('account.closePauses', { count: series.length, names: series.map((r) => r.template.payee || t('recur.noPayee')).join(', ') }));
              if (window.confirm(lines.join('\n\n'))) {
                void run(() => setAccountClosed(account.id, true));
              }
            }}
            className="ml-auto text-sm text-red-600 hover:underline"
            title={balance !== 0 ? t('account.closeBalance', { amount: formatMoney(balance, currency) }) : undefined}
          >
            {t('account.close')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const lines = [t('account.deleteConfirm', { name: account.name })];
              if (account.openingBalance !== 0) lines.push(t('account.deleteOpening', { amount: formatMoney(account.openingBalance, currency) }));
              if (window.confirm(lines.join('\n\n'))) void run(() => deleteAccount(account.id));
            }}
            className="ml-auto text-sm text-red-600 hover:underline"
          >
            {t('account.delete')}
          </button>
        )}
      </div>
    </form>
  );
}

/** The accounts list with balances, editing and backups. `className` sets its width and border for where it is shown. */
export function AccountsSidebar({ className = 'w-56 border-r border-slate-200 lg:w-64' }: { className?: string }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const setAccountClosed = useBudgetStore((s) => s.setAccountClosed);
  const moveAccount = useBudgetStore((s) => s.moveAccount);
  const moveAccountTo = useBudgetStore((s) => s.moveAccountTo);
  const dnd = useReorder((id, target, place) => void moveAccountTo(id, target, place), (id, d) => void moveAccount(id, d));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  /** Touch screens: up/down buttons instead of balances (the button only shows on phones). */
  const [reordering, setReordering] = useState(false);
  const open = state.accounts.filter((a) => !a.closed);
  const accounts = open.filter((a) => a.type !== 'debt');
  const debts = open.filter((a) => a.type === 'debt');
  const closed = state.accounts.filter((a) => a.closed);
  const total = accounts.reduce((sum, a) => sum + accountBalance(state, a.id), 0);
  const owed = debts.reduce((sum, a) => sum + accountBalance(state, a.id), 0);

  /** One list of accounts: reorder buttons, the edit form, or name and balance. */
  const accountList = (list: typeof open) => (
    <ul className="mt-3 space-y-1">
      {list.map((a, i) =>
        reordering ? (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            <MoveButtons label={a.name} first={i === 0} last={i === list.length - 1} onStep={(d) => void moveAccount(a.id, d)} />
          </li>
        ) : editing === a.id ? (
          <li key={a.id}>
            <EditAccountForm account={a} onDone={() => setEditing(null)} />
          </li>
        ) : (
          <li key={a.id} {...dnd.rowProps(a.id, 'accounts')} className="group flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setEditing(a.id)}
              aria-label={t('account.editName', { name: a.name })}
              title={t('account.clickToEdit')}
              className="truncate rounded text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {a.name}
            </button>
            {dnd.handle(a.id, a.name, 'accounts')}
            <span className="ml-auto tabular-nums">{formatMoney(accountBalance(state, a.id), currency)}</span>
          </li>
        ),
      )}
    </ul>
  );

  return (
    <aside className={`shrink-0 bg-white p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('account.heading')}</h2>
        {open.length > 1 && (
          <button
            type="button"
            onClick={() => setReordering((v) => !v)}
            className={`rounded px-2 py-1 text-xs md:hidden ${reordering ? 'bg-sky-600 text-white' : 'text-sky-700'}`}
          >
            {reordering ? t('common.done') : t('budget.reorder')}
          </button>
        )}
      </div>
      {accountList(accounts)}
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 text-sm font-medium">
        <span>{t('account.total')}</span>
        <span className="tabular-nums">{formatMoney(total, currency)}</span>
      </div>
      {debts.length > 0 && (
        <>
          <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('debt.heading')}</h2>
          {accountList(debts)}
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 text-sm font-medium">
            <span>{t('debt.totalOwed')}</span>
            <span className="tabular-nums">{formatMoney(owed, currency)}</span>
          </div>
        </>
      )}
      {adding ? (
        <AddAccountForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-4 text-sm text-sky-700 hover:underline">
          + {t('account.add')}
        </button>
      )}
      {closed.length > 0 && (
        <div className="mt-4 text-sm">
          <button type="button" onClick={() => setShowClosed((v) => !v)} aria-expanded={showClosed} className="text-slate-600 hover:underline">
            {showClosed ? '▾' : '▸'} {t('account.closed', { count: closed.length })}
          </button>
          {showClosed && (
            <ul className="mt-2 space-y-1">
              {closed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-500">{a.name}</span>
                  <button type="button" onClick={() => void setAccountClosed(a.id, false)} className="text-sky-700 hover:underline">{t('account.reopen')}</button>
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
