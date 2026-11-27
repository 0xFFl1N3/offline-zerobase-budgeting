import { useRef, useState, type ChangeEvent } from 'react';
import { createBackup, parseBackup, serializeBackup } from '../../db/backup.ts';
import { formatDate, toISODate } from '../../engine/months.ts';
import { t } from '../../i18n/i18n.ts';
import { errorText } from '../../i18n/errors.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { backupStatus } from './backupStatus.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';

/** `sidebar` is the compact version; `card` is the larger one on the Settings tab. */
export function BackupPanel({ variant = 'sidebar' }: { variant?: 'sidebar' | 'card' }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const lastBackupAt = useBudgetStore((s) => s.lastBackupAt);
  const demo = useBudgetStore((s) => s.demo);
  const importBackup = useBudgetStore((s) => s.importBackup);
  const markBackedUp = useBudgetStore((s) => s.markBackedUp);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const status = backupStatus(lastBackupAt, state.accounts.length > 0);

  const exportFile = () => {
    const json = serializeBackup(createBackup(state, currency, new Date(), demo));
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-backup-${toISODate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    void markBackedUp();
    setMessage({ text: t('backup.downloaded'), error: false });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) return setMessage({ text: errorText(result.error, 'error.backupInvalid'), error: true });
    const { data, exportedAt } = result.backup;
    const when = exportedAt ? t('backup.from', { date: formatDate(exportedAt.slice(0, 10)) }) : '';
    const ok = window.confirm(t('backup.confirm', { when, accounts: data.accounts.length, transactions: data.transactions.length }));
    if (!ok) return;
    await importBackup(result.backup);
    setMessage({ text: t('backup.restored'), error: false });
  };

  const card = variant === 'card';
  return (
    <div className={card ? 'rounded-lg bg-white p-5 shadow-sm' : 'mt-8 border-t border-slate-200 pt-4'}>
      <h2 className={card ? 'text-sm font-semibold' : 'text-xs font-semibold uppercase tracking-wide text-slate-500'}>{t('backup.title')}</h2>
      <p className={`mt-2 ${card ? 'text-sm' : 'text-xs'} ${status.warn ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{status.text}</p>
      {card && (
        <p className="mt-2 text-sm text-slate-600">
          {t('backup.explain')}
        </p>
      )}
      <div className={card ? 'mt-3 flex gap-3' : 'mt-2 flex gap-3 text-sm'}>
        <button
          type="button"
          onClick={exportFile}
          className={card ? 'rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700' : 'text-sky-700 hover:underline'}
        >
          {t('backup.export')}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={card ? 'rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50' : 'text-sky-700 hover:underline'}
        >
          {t('backup.import')}
        </button>
      </div>
      <input {...NO_AUTOFILL} ref={fileInput} type="file" accept="application/json,.json" onChange={(e) => void onFile(e)} className="hidden" aria-label={t('backup.file')} />
      {message && <p className={`mt-2 ${card ? 'text-sm' : 'text-xs'} ${message.error ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</p>}
    </div>
  );
}
