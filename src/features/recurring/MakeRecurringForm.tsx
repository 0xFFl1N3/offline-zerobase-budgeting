import { useState } from 'react';
import { formatDate } from '../../engine/months.ts';
import { FREQUENCIES } from '../../engine/recurring.ts';
import { t } from '../../i18n/i18n.ts';
import { useAction } from '../errors/useAction.ts';
import type { Frequency, Transaction } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';

/** Turns an existing transaction into the first occurrence of a recurring series. */
export function MakeRecurringForm({ transaction, onDone }: { transaction: Transaction; onDone: () => void }) {
  const makeRecurring = useBudgetStore((s) => s.makeRecurring);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [endDate, setEndDate] = useState('');
  const { run, error } = useAction();
  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

  const submit = async () => {
    if (await run(() => makeRecurring(transaction.id, frequency, endDate || null))) onDone();
  };

  return (
    <div className="flex flex-wrap items-end gap-3 bg-slate-50 px-4 py-3">
      <span className="pb-1.5 text-sm">
        {t('recur.repeatFrom', { name: transaction.payee || t('recur.thisTransaction'), date: formatDate(transaction.date) })}
      </span>
      <label className="text-xs font-medium text-slate-600">
        {t('recur.every')}
        <select aria-label={t('recur.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={`${field} mt-1 block`}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{t(`frequency.${f}`)}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        {t('recur.until')}
        <input {...NO_AUTOFILL} type="date" aria-label={t('recur.endDate')} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${field} mt-1 block`} />
      </label>
      <button type="button" onClick={() => void submit()} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">{t('recur.make')}</button>
      <button type="button" onClick={onDone} className="pb-1.5 text-sm text-slate-600 hover:underline">{t('common.cancel')}</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
