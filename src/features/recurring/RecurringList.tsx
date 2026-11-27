import { useState } from 'react';
import { formatMoney, parseMoney, toAmountInput } from '../../engine/money.ts';
import { formatDate } from '../../engine/months.ts';
import { FREQUENCIES, nextDate } from '../../engine/recurring.ts';
import { t as tr } from '../../i18n/i18n.ts';
import { useAction } from '../errors/useAction.ts';
import type { Frequency, RecurringTransaction } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { categoryLabel } from '../transactions/labels.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';

const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

function EditForm({ rec, onDone }: { rec: RecurringTransaction; onDone: () => void }) {
  const editRecurring = useBudgetStore((s) => s.editRecurring);
  const isSplit = (rec.template.splits?.length ?? 0) > 0;
  const [payee, setPayee] = useState(rec.template.payee);
  const [memo, setMemo] = useState(rec.template.memo);
  const [amount, setAmount] = useState(toAmountInput(Math.abs(rec.template.amount)));
  const [frequency, setFrequency] = useState<Frequency>(rec.frequency);
  const [endDate, setEndDate] = useState(rec.endDate ?? '');
  const { run, error, setError } = useAction();

  const save = async () => {
    const cents = parseMoney(amount);
    if (!isSplit && (cents === null || cents === 0)) return setError(tr('recur.errorAmount'));
    if (await run(() => editRecurring(rec.id, { payee, memo, frequency, endDate: endDate || null, ...(!isSplit && { amount: Math.abs(cents as number) }) }))) onDone();
  };

  return (
    <div className="flex flex-wrap items-end gap-3 bg-slate-50 px-4 py-3">
      <label className="text-xs font-medium text-slate-600">
        {tr('tx.payee')}
        <input {...NO_AUTOFILL} value={payee} onChange={(e) => setPayee(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        {tr('tx.memo')}
        <input {...NO_AUTOFILL} value={memo} onChange={(e) => setMemo(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      {!isSplit && (
        <label className="text-xs font-medium text-slate-600">
          {tr('tx.amount')}
          <input {...NO_AUTOFILL} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${field} mt-1 block w-28 text-right tabular-nums`} />
        </label>
      )}
      <label className="text-xs font-medium text-slate-600">
        {tr('recur.every')}
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={`${field} mt-1 block`}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{tr(`frequency.${f}`)}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        {tr('recur.until')}
        <input {...NO_AUTOFILL} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      <button type="button" onClick={() => void save()} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">{tr('common.save')}</button>
      <button type="button" onClick={onDone} className="pb-1.5 text-sm text-slate-600 hover:underline">{tr('common.cancel')}</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

const OPEN_KEY = 'budget-recurring-open';
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

/** Same columns for every row on wider screens: payee, what, amount, how often, next date, actions. */
const ROW = 'items-center gap-x-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_6.5rem_5.5rem_8.5rem_auto]';

/**
 * All recurring series, with edit, pause and delete, soonest first (paused and ended ones last). The pane folds
 * away to its heading; whether it is open is remembered on this device. Shown only once there is a series.
 */
export function RecurringList() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const pauseRecurring = useBudgetStore((s) => s.pauseRecurring);
  const deleteRecurring = useBudgetStore((s) => s.deleteRecurring);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(readOpen);
  if (state.recurring.length === 0) return null;

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, String(!v));
      } catch {
        // Storage blocked: it just opens again next time.
      }
      return !v;
    });
  };
  const rows = state.recurring
    .map((rec) => ({ rec, next: rec.paused ? null : nextDate(rec) }))
    .sort((a, b) => (a.next === null ? 1 : 0) - (b.next === null ? 1 : 0) || (a.next ?? '').localeCompare(b.next ?? ''));
  const soonest = rows.find((r) => r.next !== null);

  return (
    <section className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200" aria-label={tr('recur.listLabel')}>
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
        >
          <span aria-hidden="true" className="w-3">{open ? '▾' : '▸'}</span>
          {tr('recur.heading', { count: state.recurring.length })}
          {!open && soonest && (
            <span className="ml-auto truncate font-normal normal-case tracking-normal">
              {tr('recur.soonest', { name: soonest.rec.template.payee || tr('recur.noPayee'), date: formatDate(soonest.next!) })}
            </span>
          )}
        </button>
      </h2>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-200">
          {rows.map(({ rec, next }) => {
            const t = rec.template;
            const ended = !rec.paused && next === null;
            const muted = rec.paused || ended ? 'text-slate-400' : '';
            const payee = t.payee || tr('recur.noPayee');
            const amount = formatMoney(t.amount, currency);
            const often = tr(`frequency.${rec.frequency}`);
            const when = rec.paused ? tr('recur.paused') : ended ? tr('recur.ended') : tr('recur.next', { date: formatDate(next!) });
            const actions = (
              <>
                <button type="button" onClick={() => setEditing(editing === rec.id ? null : rec.id)} className="text-sky-700 hover:underline">{tr('common.edit')}</button>
                <button type="button" onClick={() => void pauseRecurring(rec.id, !rec.paused)} className="ml-3 text-sky-700 hover:underline">
                  {rec.paused ? tr('recur.resume') : tr('recur.pause')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(tr('recur.deleteConfirm', { name: t.payee || tr('recur.transaction') }))) void deleteRecurring(rec.id);
                  }}
                  className="ml-3 text-red-600 hover:underline"
                >
                  {tr('common.delete')}
                </button>
              </>
            );
            return (
              <li key={rec.id}>
                {/* Phones: name and amount, then what and when, then the actions. Wider screens: one row of columns. */}
                <div className={`px-4 py-2.5 text-sm md:hidden ${muted}`}>
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium">{payee}</span>
                    <span className="tabular-nums">{amount}</span>
                  </div>
                  <p className="mt-0.5 text-slate-600">{categoryLabel(state, t)} · {often} · <span className="whitespace-nowrap">{when}</span></p>
                  <div className="mt-1">{actions}</div>
                </div>
                <div className={`${ROW} hidden px-4 py-2 text-sm md:grid ${muted}`}>
                  <span className="min-w-0 truncate font-medium" title={t.payee}>{payee}</span>
                  <span className="min-w-0 truncate text-slate-600">{categoryLabel(state, t)}</span>
                  <span className="text-right tabular-nums">{amount}</span>
                  <span className="text-slate-600">{often}</span>
                  <span className="text-slate-600">
                    {when}
                    {rec.endDate && next !== null && <span className="block text-xs text-slate-400">{tr('recur.untilDate', { date: formatDate(rec.endDate) })}</span>}
                  </span>
                  <span className="whitespace-nowrap text-right">{actions}</span>
                </div>
                {editing === rec.id && <EditForm rec={rec} onDone={() => setEditing(null)} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
