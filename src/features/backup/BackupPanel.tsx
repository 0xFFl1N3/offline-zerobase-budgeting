import { useRef, useState, type ChangeEvent } from 'react';
import { createBackup, parseBackup, serializeBackup } from '../../db/backup.ts';
import { toISODate } from '../../engine/months.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { backupStatus } from './backupStatus.ts';

/** `sidebar` is the compact version; `card` is the larger one on the Settings tab. */
export function BackupPanel({ variant = 'sidebar' }: { variant?: 'sidebar' | 'card' }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const lastBackupAt = useBudgetStore((s) => s.lastBackupAt);
  const importBackup = useBudgetStore((s) => s.importBackup);
  const markBackedUp = useBudgetStore((s) => s.markBackedUp);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const status = backupStatus(lastBackupAt, state.accounts.length > 0);

  const exportFile = () => {
    const json = serializeBackup(createBackup(state, currency));
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-backup-${toISODate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    void markBackedUp();
    setMessage({ text: 'Backup downloaded.', error: false });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) return setMessage({ text: result.error, error: true });
    const { data, exportedAt } = result.backup;
    const when = exportedAt ? ` from ${exportedAt.slice(0, 10)}` : '';
    const ok = window.confirm(
      `Replace ALL current data with this backup${when}?\n\n` +
        `It contains ${data.accounts.length} account(s) and ${data.transactions.length} transaction(s). ` +
        `This cannot be undone, so export a backup of your current data first if you need it.`,
    );
    if (!ok) return;
    await importBackup(result.backup);
    setMessage({ text: 'Backup restored.', error: false });
  };

  const card = variant === 'card';
  return (
    <div className={card ? 'rounded-lg bg-white p-5 shadow-sm' : 'mt-8 border-t border-slate-200 pt-4'}>
      <h2 className={card ? 'text-sm font-semibold' : 'text-xs font-semibold uppercase tracking-wide text-slate-500'}>Backup</h2>
      <p className={`mt-2 ${card ? 'text-sm' : 'text-xs'} ${status.warn ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{status.text}</p>
      {card && (
        <p className="mt-2 text-sm text-slate-600">
          Export saves all your data to a file you can keep or move to another device. Import replaces everything with the contents of such a file.
        </p>
      )}
      <div className={card ? 'mt-3 flex gap-3' : 'mt-2 flex gap-3 text-sm'}>
        <button
          type="button"
          onClick={exportFile}
          className={card ? 'rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700' : 'text-sky-700 hover:underline'}
        >
          Export
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={card ? 'rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50' : 'text-sky-700 hover:underline'}
        >
          Import
        </button>
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" onChange={(e) => void onFile(e)} className="hidden" aria-label="Backup file" />
      {message && <p className={`mt-2 ${card ? 'text-sm' : 'text-xs'} ${message.error ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</p>}
    </div>
  );
}
