import { useState } from 'react';
import { formatMoney, parseMoney, toAmountInput } from '../../engine/money.ts';
import { FREQUENCIES, FREQUENCY_LABELS, nextDate } from '../../engine/recurring.ts';
import type { Frequency, RecurringTransaction } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { categoryLabel } from '../transactions/labels.ts';

const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

function EditForm({ rec, onDone }: { rec: RecurringTransaction; onDone: () => void }) {
  const editRecurring = useBudgetStore((s) => s.editRecurring);
  const isSplit = (rec.template.splits?.length ?? 0) > 0;
  const [payee, setPayee] = useState(rec.template.payee);
  const [memo, setMemo] = useState(rec.template.memo);
  const [amount, setAmount] = useState(toAmountInput(Math.abs(rec.template.amount)));
  const [frequency, setFrequency] = useState<Frequency>(rec.frequency);
  const [endDate, setEndDate] = useState(rec.endDate ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const cents = parseMoney(amount);
    if (!isSplit && (cents === null || cents === 0)) return setError('Enter a valid amount.');
    try {
      await editRecurring(rec.id, { payee, memo, frequency, endDate: endDate || null, ...(!isSplit && { amount: Math.abs(cents as number) }) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 bg-slate-50 px-4 py-3">
      <label className="text-xs font-medium text-slate-600">
        Payee
        <input value={payee} onChange={(e) => setPayee(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Memo
        <input value={memo} onChange={(e) => setMemo(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      {!isSplit && (
        <label className="text-xs font-medium text-slate-600">
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${field} mt-1 block w-28 text-right tabular-nums`} />
        </label>
      )}
      <label className="text-xs font-medium text-slate-600">
        Every
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={`${field} mt-1 block`}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        Until (optional)
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      <button type="button" onClick={() => void save()} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">Save</button>
      <button type="button" onClick={onDone} className="pb-1.5 text-sm text-slate-600 hover:underline">Cancel</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** All recurring series, with edit, pause and delete. Shown only once there is at least one. */
export function RecurringList() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const pauseRecurring = useBudgetStore((s) => s.pauseRecurring);
  const deleteRecurring = useBudgetStore((s) => s.deleteRecurring);
  const [editing, setEditing] = useState<string | null>(null);
  if (state.recurring.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg bg-white shadow-sm" aria-label="Recurring transactions">
      <h2 className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recurring ({state.recurring.length})
      </h2>
      <ul className="divide-y divide-slate-100">
        {state.recurring.map((rec) => {
          const t = rec.template;
          const next = nextDate(rec);
          const status = rec.paused ? 'Paused' : next === null ? 'Ended' : `Next: ${next}`;
          return (
            <li key={rec.id}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                <span className="min-w-32 font-medium">{t.payee || '(no payee)'}</span>
                <span className="text-slate-600">{categoryLabel(state, t)}</span>
                <span className="tabular-nums">{formatMoney(t.amount, currency)}</span>
                <span className="text-slate-600">{FREQUENCY_LABELS[rec.frequency]}</span>
                <span className={rec.paused || next === null ? 'text-slate-400' : 'text-slate-600'}>{status}</span>
                {rec.endDate && next !== null && <span className="text-slate-400">until {rec.endDate}</span>}
                <span className="ml-auto whitespace-nowrap">
                  <button type="button" onClick={() => setEditing(editing === rec.id ? null : rec.id)} className="text-sky-700 hover:underline">Edit</button>
                  <button type="button" onClick={() => void pauseRecurring(rec.id, !rec.paused)} className="ml-3 text-sky-700 hover:underline">
                    {rec.paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete the recurring "${t.payee || 'transaction'}"? Transactions already booked from it stay.`)) void deleteRecurring(rec.id);
                    }}
                    className="ml-3 text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </span>
              </div>
              {editing === rec.id && <EditForm rec={rec} onDone={() => setEditing(null)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
