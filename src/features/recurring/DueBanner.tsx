import { useState } from 'react';
import { formatMoney, parseMoney, toAmountInput } from '../../engine/money.ts';
import { formatDate, toISODate } from '../../engine/months.ts';
import { t as tr } from '../../i18n/i18n.ts';
import { bookingBlocked, dueItems, type DueItem } from '../../engine/recurring.ts';
import type { RecurringTransaction } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { categoryLabel } from '../transactions/labels.ts';

function DueRow({ item, rec }: { item: DueItem; rec: RecurringTransaction }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const confirmRecurring = useBudgetStore((s) => s.confirmRecurring);
  const skipRecurring = useBudgetStore((s) => s.skipRecurring);
  const t = rec.template;
  const isSplit = (t.splits?.length ?? 0) > 0;
  const [amountText, setAmountText] = useState(toAmountInput(Math.abs(t.amount)));
  const [error, setError] = useState<string | null>(null);
  const account = state.accounts.find((a) => a.id === t.accountId)?.name ?? '?';
  // A series whose account was closed or category archived (e.g. before 0.6.5) must not book out of sight.
  const blocked = bookingBlocked(state, rec);

  const confirm = () => {
    const cents = parseMoney(amountText);
    if (cents === null || cents === 0) return setError(tr('recur.errorAmount'));
    const changed = Math.abs(cents) !== Math.abs(t.amount);
    void confirmRecurring(rec.id, changed && !isSplit ? Math.abs(cents) : undefined);
  };

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
      <span className="w-24 tabular-nums text-slate-600">{formatDate(item.date)}</span>
      <span className="min-w-32 font-medium">{t.payee || tr('recur.noPayee')}</span>
      <span className="text-slate-600">
        {account} · {categoryLabel(state, t)}
      </span>
      {item.moreAfter > 0 && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{tr('recur.moreDue', { count: item.moreAfter })}</span>}
      <span className="ml-auto flex items-center gap-3">
        {isSplit ? (
          <span className="tabular-nums">{formatMoney(t.amount, currency)}</span>
        ) : (
          <input
            aria-label={tr('recur.amountFor', { name: t.payee || tr('recur.thisRecurring'), date: formatDate(item.date) })}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            inputMode="decimal"
            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right tabular-nums"
          />
        )}
        {!blocked && <button type="button" onClick={confirm} className="rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-700">{tr('recur.confirm')}</button>}
        <button type="button" onClick={() => void skipRecurring(rec.id)} className="text-slate-600 hover:underline">{tr('recur.skip')}</button>
      </span>
      {blocked && <span className="w-full text-xs text-amber-900">{tr(blocked === 'closedAccount' ? 'recur.blockedAccount' : 'recur.blockedCategory')}</span>}
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </li>
  );
}

/** Recurring transactions that have come due: confirm each (the amount can be changed first) or skip it. */
export function DueBanner() {
  const recurring = useBudgetStore((s) => s.state.recurring);
  const items = dueItems(recurring, toISODate());
  if (items.length === 0) return null;
  return (
    <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4" aria-label={tr('recur.dueLabel')}>
      <h2 className="text-sm font-semibold text-amber-900">
        {tr('recur.dueTitle', { count: items.length })}
      </h2>
      <ul className="mt-1 divide-y divide-amber-200">
        {items.map((item) => {
          const rec = recurring.find((r) => r.id === item.recurringId);
          return rec ? <DueRow key={`${item.recurringId}-${item.date}`} item={item} rec={rec} /> : null;
        })}
      </ul>
    </section>
  );
}
