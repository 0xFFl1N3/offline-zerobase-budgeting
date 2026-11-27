import { Fragment, useState } from 'react';
import { formatMoney } from '../../engine/money.ts';
import { parseAmountInput } from '../../engine/amountInput.ts';
import { accountBalances } from '../../engine/reconcile.ts';
import { formatDate } from '../../engine/months.ts';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { useAction } from '../errors/useAction.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { Form } from '../../components/Form.tsx';

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
  const { run, error, setError } = useAction();
  const [done, setDone] = useState<string | null>(null);

  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const balances = accountBalances(state, accountId);
  // A debt or tracking account is outside the budget: its difference only changes what is owed or worth, without a category.
  const debt = account.type === 'debt' || account.type === 'tracking';
  const statement = parseAmountInput(statementText);
  const difference = statement === null ? null : statement - balances.cleared;

  const close = () => {
    setOpen(false);
    setStatementText('');
    setCategoryId('');
    setError(null);
  };

  const finish = () => {
    if (statement === null || difference === null) return setError(t('rec.errorStatement'));
    if (difference < 0 && !categoryId && !debt) return setError(t('rec.errorCategory'));
    const locked = balances.clearedCount;
    void run(() => reconcileAccount(accountId, statement, difference === 0 || debt ? null : categoryId || null)).then((ok) => {
      if (!ok) return;
      setDone(
        t('rec.doneBase', { name: account.name, amount: fmt(statement) }) +
          (locked > 0 ? t('rec.doneLocked', { count: locked }) : '') +
          (difference !== 0 ? t('rec.doneAdjustment', { amount: fmt(difference) }) : '') +
          '.',
      );
      close();
    });
  };

  return (
    <div className="mt-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-xs text-slate-500">{t('rec.cleared')}</span>{' '}
          <span className="font-semibold tabular-nums">{fmt(balances.cleared)}</span>
        </span>
        <span>
          <span className="text-xs text-slate-500">{t('rec.uncleared')}</span> <span className="tabular-nums">{fmt(balances.uncleared)}</span>
        </span>
        <span>
          <span className="text-xs text-slate-500">{t('rec.working')}</span> <span className="tabular-nums">{fmt(balances.working)}</span>
        </span>
        <span className="text-xs text-slate-500">
          {account.lastReconciled ? t('rec.last', { date: formatDate(account.lastReconciled) }) : t('rec.never')}
        </span>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setDone(null); }} className="ml-auto rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            {t('rec.reconcile')}
          </button>
        )}
      </div>
      {done && !open && <p className="mt-2 text-sm text-emerald-700" role="status">{done}</p>}

      {open && (
        <Form onSubmit={finish} className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600">
              {t('rec.statement')}
              <input {...NO_AUTOFILL}
                autoFocus
                value={statementText}
                onChange={(e) => { setStatementText(e.target.value); setError(null); }}
                inputMode="decimal"
                placeholder={t('common.amountPlaceholder')}
                className={`${field} mt-1 block w-36 text-right tabular-nums`}
              />
            </label>
            {difference !== null && (
              <p className="pb-1.5 text-sm" role="status">
                {difference === 0 ? (
                  <span className="text-emerald-700">{t('rec.matches')}</span>
                ) : (
                  <span className="text-amber-700">
                    {t(difference > 0 ? 'rec.more' : 'rec.less', { amount: fmt(Math.abs(difference)) })}
                  </span>
                )}
              </p>
            )}
          </div>

          {difference !== null && difference !== 0 && (
            <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                {/* The amount sits wherever the language puts it in the sentence, and is shown in bold. */}
                {t('rec.tickHint', { amount: '\u0000' }).split('\u0000').map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="font-semibold tabular-nums">{fmt(difference)}</span>}
                    {part}
                  </Fragment>
                ))}
              </p>
              {debt ? (
                <p className="mt-2 text-xs">{t('rec.debtAdjustment')}</p>
              ) : (
              <label className="mt-2 block text-xs font-medium">
                {t('rec.adjustmentCategory')}
                <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setError(null); }} className={`${field} mt-1 block`}>
                  <option value="">{difference > 0 ? t('tx.income') : t('tx.chooseCategory')}</option>
                  {state.groups.filter((g) => !g.archived).map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {state.categories.filter((c) => c.groupId === g.id && !c.archived).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={difference === null} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
              {difference !== null && difference !== 0 ? t('rec.finishAdjust') : t('rec.finish')}
            </button>
            <button type="button" onClick={close} className="text-sm text-slate-600 hover:underline">{t('common.cancel')}</button>
            <span className="text-xs text-slate-500">{t('rec.locks', { count: balances.clearedCount })}</span>
          </div>
        </Form>
      )}
    </div>
  );
}
